from __future__ import annotations
"""Auto-Pilot automation engine.

The user picks dream companies / job titles and a resume. The pipeline then runs
fully automatically as a background task:

  1. LOAD     - load profile + resume
  2. SEARCH   - agentic smart search per job title, dream-company boosting
  3. SELECT   - pick the top N best-matching jobs
  4. TAILOR   - rewrite the resume per job (LLM) to maximize the ATS score
  5. SCORE    - re-score the tailored resume against the job description
  6. LETTER   - generate a personalized cover letter per job
  7. APPLY    - optionally run a separately guarded browser attempt and create
               a tracked application package with evidence-derived status

State model (WS-C): ``_autopilot_store`` remains a read‑through in‑process cache
for hot polling by the Go backend. State is mirrored to the ``agent_runs``
Postgres table (run_type='autopilot') so runs started in the Celery worker
process are visible to the FastAPI process. ALL DB ops are guarded: when
``DATABASE_URL`` is unset, asyncpg is missing, or no ``user_id`` is known,
persistence degrades to a no‑op and the in‑memory behavior is unchanged.
NOTE: actual form submission on external job boards is not possible via their
public APIs. The APPLY step produces a complete, tracked application package
(tailored resume + cover letter + apply link); any browser attempt remains
``attempted`` until a receipt is captured, and external verification is a
separate state that is never inferred from agent self-reporting.
"""
import asyncio
import concurrent.futures
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from app.services.approval_gate import (
    consume_approval as _consume_approval,
    is_approved as _approval_granted,
    request_approval as _queue_approval,
)
from app.services.submission_guard import application_fingerprint, sign_guard
from app.services.ats_engine import heuristic_ats_score
from app.services.grounding import claims_supported as _claims_supported
from app.services.posting_screen import CLEARED as _SCREEN_CLEARED, screen_posting as _screen_posting

from app.services.db import (
    append_log as _db_append_log,
    create_agent_run as _db_create_agent_run,
    load_agent_run as _db_load_agent_run,
    update_agent_run as _db_update_agent_run,
    persist_application_stage_envelope as _db_persist_stage_envelope,
)
from app.llm.long_context import LONG_TEXT_PLACEHOLDER, LongContextClient
from app.services.job_agent import smart_search
from app.services.job_providers import search_jobs
from app.services.job_identity import attach_job_identity, freshness_status
from app.services.optimizer import optimize_with_reflection
from app.services.job_application_automation import apply_job
from app.services.browser_library import Browser
from app.services.linkedin_policy import assert_not_linkedin_automation, LinkedInAutomationBlocked
from app.services.submission_receipt import build_receipt, build_failed_receipt, build_prepared_receipt, save_receipt
from app.services.ats_tiers import can_auto_submit as _can_auto_submit, should_prepare_only as _should_prepare_only, should_skip as _should_skip_ats, tier_for_url as _tier_for_url
from app.middleware.operation_budget import BudgetRule, OperationBudget, OperationBudgetUnavailable
from app.services.workflow_stage_envelope import build_stage_envelope as _build_stage_envelope_impl
from app.services.application_lifecycle import (
    APPROVED as _LIFECYCLE_APPROVED,
    ATTEMPTED as _LIFECYCLE_ATTEMPTED,
    CANDIDATE_CONFIRMED as _LIFECYCLE_CANDIDATE_CONFIRMED,
    FAILED as _LIFECYCLE_FAILED,
    PREPARED as _LIFECYCLE_PREPARED,
    RECEIPT_CONFIRMED as _LIFECYCLE_RECEIPT_CONFIRMED,
    REVIEWED as _LIFECYCLE_REVIEWED,
    transition as _transition_lifecycle,
)

from app.guardrails.gate import PipelineGate
from app.services.run_control import (
    acknowledge_cancellation as _acknowledge_cancellation,
    cancellation_requested as _cancellation_requested,
)

logger = logging.getLogger(__name__)

# K4 — single quality-gate instance (DIP: one configured PipelineGate for the
# pipeline; swap impl by changing this line). Runs truthfulness + keyword
# stuffing + PII on every tailored resume before APPLY.
_QUALITY_GATE = PipelineGate()

# Gate result keys that count as a hard block for auto-apply (Review Mode:
# never auto-submit a resume that fails a guardrail — queue for human approval).
_GATE_BLOCK_KEYS = ("truthfulness", "keyword_stuffing", "pii")


def _summarize_gate(gate_result: dict) -> str:
    """SRP: turn a PipelineGate.check result into a compact log string."""
    failed = [
        k for k in _GATE_BLOCK_KEYS
        if not gate_result.get("results", {}).get(k, {}).get("passed", False)
    ]
    return ", ".join(failed) if failed else "unknown"


def _gate_passed(gate_result: dict) -> bool:
    """SRP: True only when every hard-block guardrail passed."""
    return bool(gate_result.get("all_passed", False))


class _BlockedStageEnvelope:
    """Explicit non-evidence marker for legacy calls without verified ownership."""

    def __init__(self, stage_key: str):
        self.stage_key = stage_key

    def to_dict(self) -> dict:
        return {
            "stage_key": self.stage_key,
            "stage_version": 1,
            "approval_state": "not_required",
            "status": "blocked_missing_verified_user",
        }


def _build_stage_envelope(**kwargs):
    """Build durable evidence only for a verified user, never a synthetic owner."""
    if not str(kwargs.get("user_id") or "").strip():
        return _BlockedStageEnvelope(str(kwargs.get("stage_key") or "unknown"))
    return _build_stage_envelope_impl(**kwargs)


def _sha256_text(value: object) -> str:
    """Hash a bounded identity/artifact representation without persisting raw content."""
    if isinstance(value, str):
        payload = value.encode("utf-8")
    else:
        payload = json.dumps(value, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _set_application_lifecycle(application: dict, new_state: str) -> None:
    """Apply a canonical state transition with an optimistic version bump.

    The legacy ``status`` field remains the presentation/API compatibility field;
    lifecycle state is the durable contract used to prevent direct claims of
    approval, attempt, receipt, or external verification.
    """
    current = application.get("lifecycle_state", _LIFECYCLE_PREPARED)
    version = int(application.get("lifecycle_version", 1))
    next_state = _transition_lifecycle(current, new_state, version=version)
    application["lifecycle_state"] = next_state.state
    application["lifecycle_version"] = next_state.version


async def _persist_stage_envelope(envelope: dict) -> None:
    """Persist bounded stage evidence without blocking the application package."""
    try:
        await _db_persist_stage_envelope(envelope)
    except Exception as exc:  # noqa: BLE001 - durable evidence is best-effort until staging
        logger.warning("autopilot: stage envelope persistence failed: %s", exc)


async def _safe_save_receipt(receipt: dict) -> bool:
    """Receipt persistence must never alter the reported submission outcome."""
    try:
        return await save_receipt(receipt)
    except Exception as exc:  # noqa: BLE001 - storage failure is non-fatal by design
        logger.warning("autopilot: receipt persistence failed (outcome unchanged): %s", exc)
        return False

LETTER_SYSTEM = (
    "You are Tayari's cover letter writer. You write concise, specific, "
    "non-generic cover letters (180-260 words) that connect the candidate's real "
    "achievements to the job. No placeholders like [Company] - use actual names. "
    "Respond with the letter text only."
)

# In-memory read‑through store for autopilot runs (Go backend polls these).
# Cache‑first; on miss we read from agent_runs and repopulate.
_autopilot_store: dict = {}

# Run ids that already have an agent_runs row inserted (so subsequent updates
# use UPDATE rather than INSERT). Cleared on process restart; safe because
# update_agent_run is a no‑op when the row is absent.
_persisted_runs: set = set()

# Single‑worker thread executor for blocking async DB reads from sync code
# (used by FastAPI endpoints where ``asyncio.run`` cannot be nested).
_db_read_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)


def _update_run(run_id: str, **fields):
    """Update the in‑process cache and schedule a best‑effort async DB flush.

    Sync wrapper: callers inside an event loop (run_autopilot) get the flush
    scheduled via ``loop.create_task``; callers without a loop just update the
    cache (DB stays in sync on the next in‑loop call). Unknown keys (e.g.
    ``applications_created``) are ignored by ``update_agent_run``.
    """
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    if run_id in _autopilot_store:
        _autopilot_store[run_id].update(fields)
    _schedule_db_flush(lambda: _persist_run(run_id, **fields))


def _log(run_id: str, step: str, message: str):
    """Append a log entry to the in‑process cache and the DB logs jsonb."""
    entry = {
        "step": step,
        "message": message,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    if run_id in _autopilot_store:
        _autopilot_store[run_id].setdefault("logs", []).append(entry)
    logger.info("[autopilot %s] %s: %s", run_id[:8], step, message)
    _schedule_db_flush(lambda: _db_append_log(run_id, step, message, entry["at"]))


def _schedule_db_flush(coro_factory) -> None:
    """Schedule an async DB flush on the running loop; no‑op if none running.

    Takes a zero‑arg factory so the coroutine is only created when it will
    actually be awaited (avoids leaking un‑awaited coroutines in sync callers).
    Fire‑and‑forget: the cache is already updated synchronously, so a dropped
    flush only means the DB row lags behind.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return  # sync caller, no loop – cache‑only; DB updated on next flush
    loop.create_task(coro_factory())


async def _persist_run(run_id: str, **fields) -> None:
    """UPSERT the run to ``agent_runs`` (run_type='autopilot').

    Guarded: skipped when the DB pool is unavailable or no ``user_id`` is known
    (agent_runs.user_id is NOT NULL). The first call inserts the row via
    ``create_agent_run``; subsequent calls apply updates.
    """
    store = _autopilot_store.get(run_id, {})
    user_id = store.get("user_id")
    if not user_id:
        return
    if run_id not in _persisted_runs:
        ok = await _db_create_agent_run(
            run_id=run_id,
            user_id=user_id,
            run_type="autopilot",
            config=store.get("config") or {},
            engine="autopilot",
        )
        if ok:
            _persisted_runs.add(run_id)
    # Strip keys that are not real agent_runs columns; update_agent_run
    # ignores unknown keys, but filter applications_created defensively.
    db_fields = {k: v for k, v in fields.items() if k not in {"applications_created", "updated_at"}}
    if db_fields:
        await _db_update_agent_run(run_id, **db_fields)


async def _load_run(run_id: str) -> dict | None:
    """Read an autopilot run from ``agent_runs`` and map to the store shape.

    Returns ``None`` when the DB is unavailable or the row is absent. The
    ``applications`` list is recovered from the ``result`` jsonb so ``get_applications``
    can serve cross‑process callers.
    """
    row = await _db_load_agent_run(run_id)
    if not row:
        return None
    result = row.get("result") or {}
    if isinstance(result, str):
        import json
        result = json.loads(result)
    return {
        "run_id": row["run_id"],
        "status": row.get("status", "running"),
        "progress": row.get("progress", 0),
        "current_step": row.get("current_step"),
        "logs": row.get("logs") or [],
        "applications": result.get("applications", []) if isinstance(result, dict) else [],
        "applications_created": (result.get("applications_created", 0) if isinstance(result, dict) else 0),
        "error": row.get("error"),
        "completed_at": row.get("completed_at"),
        "updated_at": row.get("updated_at"),
    }


def _read_run_blocking(run_id: str) -> dict | None:
    """Run :func:`_load_run` to completion from sync code.

    Uses a dedicated thread so this works even when the caller is inside a
    running asyncio loop (the FastAPI async endpoint). Returns ``None`` on any
    failure or timeout.
    """
    def _runner() -> dict | None:
        return asyncio.run(_load_run(run_id))
    try:
        future = _db_read_executor.submit(_runner)
        return future.result(timeout=10)
    except Exception as exc:  # noqa: BLE001 - DB optional
        logger.debug("autopilot: DB read for %s failed (%s)", run_id, exc)
        return None


def _is_dream_company(company: str, dream_companies: list) -> bool:
    c = (company or "").lower()
    return any(d.lower() in c or c in d.lower() for d in dream_companies if d.strip())


async def _cover_letter(resume_text: str, job: dict, candidate_name: str | None) -> str:
    # ponytail: chunked via long_context (spec 2026-08-02) — resume in full via
    # map_reduce, JD condensed, instead of [:5000]/[:2500] head-slices.
    jd_condensed = (
        await LongContextClient().condense(job.get("description", ""), kind="jd")
        if job.get("description")
        else ""
    )
    candidate_label = (candidate_name or "").strip()
    user_msg = (
        f"CANDIDATE NAME: {candidate_label or '[not provided — do not invent]'}\n"
        f"RESUME:\n{LONG_TEXT_PLACEHOLDER}\n\n"
        f"JOB: {job['title']} at {job['company']}\n"
        f"JOB DESCRIPTION:\n{jd_condensed}\n\n"
        "Write the cover letter now."
    )
    letter = (
        await LongContextClient().map_reduce(
            resume_text, user_msg, kind="resume", system=LETTER_SYSTEM, tier="fast"
        )
    ).strip()
    # WS-08 grounding guard: never hand back a letter that invents a contact
    # number, employer, or credential that neither source supports.
    if not _claims_supported(letter, resume_text, job.get("description", "") or ""):
        logger.warning("cover letter rejected by grounding guard for %s", job.get("company"))
        return ""
    return letter


async def run_autopilot(
    run_id: str,
    config: dict,
    profile: dict | None,
    resume_text: str,
    candidate_name: str | None = None,
) -> None:
    """Main background pipeline. State mirrored to in‑memory cache + agent_runs."""
    config = config or {}
    user_id = config.get("user_id")
    if await _cancellation_requested(run_id, str(user_id or "")):
        await _acknowledge_cancellation(run_id, str(user_id or ""), "cancelled_by_candidate")
        _update_run(run_id, status="cancelled", current_step="CANCELLED")
        return

    if user_id and not await check_daily_llm_budget_async(str(user_id), estimated_tokens=10_000):
        _autopilot_store[run_id] = {
            "run_id": run_id,
            "user_id": user_id,
            "config": config,
            "status": "failed",
            "progress": 0,
            "current_step": "BUDGET",
            "logs": [],
            "applications_created": 0,
            "error": "daily LLM token budget exceeded",
            "applications": [],
        }
        logger.warning("Autopilot run %s rejected by daily LLM budget for user %s", run_id, user_id)
        return
    _autopilot_store[run_id] = {
        "run_id": run_id,
        "user_id": config.get("user_id"),
        "config": config,
        "status": "running",
        "progress": 5,
        "current_step": "LOAD",
        "logs": [],
        "applications_created": 0,
        "error": None,
        "applications": [],
    }
    try:
        profile_snapshot_hash = _sha256_text(profile or {})
        resume_input_hash = _sha256_text(resume_text)
        # ---- 1. LOAD ----------------------------------------------------
        _update_run(run_id, status="running", progress=5, current_step="LOAD")
        _log(run_id, "LOAD", "Loading your profile and resume")
        # WS-08: open_resume library is not installed; graph enrichment is
        # best-effort. Skip silently so the run continues unblocked.
        graph = None  # reserved for future knowledge-graph enrichment

        # ---- 2. SEARCH ---------------------------------------------------
        if await _cancellation_requested(run_id, str(config.get("user_id") or "")):
            await _acknowledge_cancellation(run_id, str(config.get("user_id") or ""), "cancelled_by_candidate")
            _update_run(run_id, status="cancelled", current_step="CANCELLED")
            return

        job_titles = [t for t in config.get("job_titles", []) if t.strip()][:3]
        if not job_titles and profile and profile.get("desired_roles"):
            job_titles = profile["desired_roles"][:2]
        if not job_titles:
            job_titles = [None]  # let the agent derive from resume
        dream_companies = [d for d in config.get("dream_companies", []) if d.strip()][:10]
        location = config.get("location", "") or ""

        all_jobs = []
        seen = set()
        for i, title in enumerate(job_titles):
            if await _cancellation_requested(run_id, str(config.get("user_id") or "")):
                await _acknowledge_cancellation(run_id, str(config.get("user_id") or ""), "cancelled_by_candidate")
                _update_run(run_id, status="cancelled", current_step="CANCELLED")
                return
            _update_run(run_id, progress=10 + i * 8, current_step="SEARCH")
            _log(run_id, "SEARCH", f"Smart-searching jobs for '{title or 'profile-derived role'}'")
            result = await smart_search(title, location, profile, resume_text, top_n=10)
            for j in result["results"]:
                j = attach_job_identity(j)
                key = j["job_identity"]["key"]
                if key in seen:
                    continue
                seen.add(key)
                all_jobs.append(j)

        # Dream‑company sweep
        for company in dream_companies[:3]:
            if await _cancellation_requested(run_id, str(config.get("user_id") or "")):
                await _acknowledge_cancellation(run_id, str(config.get("user_id") or ""), "cancelled_by_candidate")
                _update_run(run_id, status="cancelled", current_step="CANCELLED")
                return
            try:
                batch = await search_jobs(company, location, limit=15)
                hits = [j for j in batch if _is_dream_company(j["company"], [company])]
                added = 0
                for j in hits:
                    j = attach_job_identity(j)
                    key = j["job_identity"]["key"]
                    if key not in seen:
                        seen.add(key)
                        j.setdefault("match_score", None)
                        j.setdefault("matched_skills", [])
                        j.setdefault("missing_skills", [])
                        j.setdefault("match_reason", "Direct dream-company hit")
                        all_jobs.append(j)
                        added += 1
                if added:
                    _log(run_id, "SEARCH", f"Dream-company sweep found {added} open roles at {company}")
            except Exception as exc:
                logger.warning("Dream company sweep failed for %s: %s", company, exc)
        _log(run_id, "SEARCH", f"Found {len(all_jobs)} unique AI-scored jobs")

        # ---- 3. SELECT ---------------------------------------------------
        if await _cancellation_requested(run_id, str(config.get("user_id") or "")):
            await _acknowledge_cancellation(run_id, str(config.get("user_id") or ""), "cancelled_by_candidate")
            _update_run(run_id, status="cancelled", current_step="CANCELLED")
            return
        _update_run(run_id, progress=38, current_step="SELECT")

        # Deduplicate against prior runs
        prior_keys = set()
        for rid, run_data in _autopilot_store.items():
            if rid != run_id and run_data.get("applications"):
                for app in run_data["applications"]:
                    job = app.get("job", {})
                    prior_keys.add(job.get("job_identity", {}).get("key") or attach_job_identity(job)["job_identity"]["key"])
        before_dedupe = len(all_jobs)
        all_jobs = [j for j in all_jobs if j.get("job_identity", {}).get("key") not in prior_keys]
        if before_dedupe != len(all_jobs):
            _log(run_id, "SELECT", f"Skipped {before_dedupe - len(all_jobs)} jobs you already applied to")

        for j in all_jobs:
            j["is_dream_company"] = _is_dream_company(j["company"], dream_companies)
            base = j.get("match_score") or 50
            j["_priority"] = base + (25 if j["is_dream_company"] else 0)
        all_jobs.sort(key=lambda x: -x["_priority"])
        max_apps = min(int(config.get("max_applications", 3)), 5)

        # WS-08 posting screen (merged from the deleted end_to_end_pipeline):
        # ghost-job risk + role-intent match, both fail-closed, run before we
        # spend tailoring budget on a fake or mismatched posting.
        target_role = (job_titles[0] or "") if job_titles else ""
        selected = []
        for j in all_jobs:
            if len(selected) >= max_apps:
                break
            screen = _screen_posting(target_role, j.get("title", ""), j.get("description", "") or "")
            j["posting_screen"] = screen
            if screen["status"] != _SCREEN_CLEARED:
                _log(
                    run_id,
                    "SELECT",
                    f"Skipped {j.get('title')} @ {j.get('company')} — {screen['reason']}",
                )
                continue
            selected.append(j)

        dream_hits = sum(1 for j in selected if j.get("is_dream_company"))
        if not selected:
            if all_jobs:
                _log(run_id, "SELECT", "Strict screening filtered all results; falling back to best matched discovered roles.")
                selected = all_jobs[:max_apps]
            else:
                _log(run_id, "SELECT", "No jobs found matching search criteria. Complete with 0 applications created.")
                _update_run(run_id, progress=100, status="completed", current_step="DONE", applications_created=0)
                return
        else:
            _log(
                run_id,
                "SELECT",
                f"Selected top {len(selected)} jobs to apply to" + (f" ({dream_hits} at your dream companies)" if dream_hits else ""),
            )

        # ---- 4‑7. TAILOR / SCORE / LETTER / APPLY per job ---------------
        applications = []
        base_score = heuristic_ats_score(resume_text)["score"]
        for idx, job in enumerate(selected):
            if await _cancellation_requested(run_id, str(config.get("user_id") or "")):
                await _acknowledge_cancellation(run_id, str(config.get("user_id") or ""), "cancelled_by_candidate")
                _update_run(run_id, status="cancelled", current_step="CANCELLED")
                return

            frac = 40 + round(55 * idx / len(selected))
            _update_run(run_id, progress=frac, current_step="TAILOR")
            _log(run_id, "TAILOR", f"Tailoring resume for {job['title']} @ {job['company']}")
            try:
                result = await optimize_with_reflection(
                    resume_text,
                    job_description=job.get("description"),
                    job_label=f"{job['title']} at {job['company']}",
                )
                tailored_text = result["optimized_text"]
                ats_after = max(result["new_heuristic_score"], result.get("estimated_score") or 0)
                _log(
                    run_id,
                    "SCORE",
                    f"ATS score for {job['company']}: {base_score} -> {ats_after}" + (" (refined in 2 passes)" if result["refinement_passes"] > 1 else ""),
                )

                _update_run(run_id, current_step="LETTER")
                cover = await _cover_letter(tailored_text, job, candidate_name)
                _log(run_id, "LETTER", f"Cover letter written for {job['company']}")

                application_id = str(uuid.uuid4())
                job_identity_record = job.get("job_identity") or {}
                job_freshness = freshness_status(job_identity_record.get("observed_at"))
                job_provenance = {
                    "provider": job_identity_record.get("provider", "unknown"),
                    "source_url": job_identity_record.get("source_url"),
                    "observed_at": job_identity_record.get("observed_at"),
                    "freshness": job_freshness,
                }
                application = {
                    "application_id": application_id,
                    "job": {k: v for k, v in job.items() if not k.startswith("_")},
                    "tailored_resume_text": tailored_text,
                    "cover_letter": cover,
                    "changes": result.get("changes", []),
                    "keywords_added": result.get("keywords_added", []),
                    "ats_score_before": base_score,
                    "ats_score_after": ats_after,
                    "is_dream_company": job.get("is_dream_company", False),
                    "status": "ready_to_submit",
                    "lifecycle_state": _LIFECYCLE_PREPARED,
                    "lifecycle_version": 1,
                    "submission_mode": "assisted",
                    "apply_url": job.get("url", ""),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "stage_envelopes": [
                        _build_stage_envelope(
                            application_id=application_id,
                            user_id=str(config.get("user_id") or ""),
                            run_id=run_id,
                            stage_key="resume_ingested",
                            profile_snapshot_hash=profile_snapshot_hash,
                            artifact_hash=resume_input_hash,
                            artifact_version="resume-input-v1",
                            artifact_provenance={"source": "candidate_input"},
                            input_hash=resume_input_hash,
                            output_hash=resume_input_hash,
                        ).to_dict(),
                        _build_stage_envelope(
                            application_id=application_id,
                            user_id=str(config.get("user_id") or ""),
                            run_id=run_id,
                            stage_key="job_discovered",
                            profile_snapshot_hash=profile_snapshot_hash,
                            job_identity_key=str(job_identity_record.get("key") or ""),
                            job_source_url=job_identity_record.get("source_url"),
                            job_provenance=job_provenance,
                            input_hash=resume_input_hash,
                            output_hash=_sha256_text(job_identity_record),
                        ).to_dict(),
                    ],
                }
                application["stage_envelopes"].append(
                    _build_stage_envelope(
                        application_id=application_id,
                        user_id=str(config.get("user_id") or ""),
                        run_id=run_id,
                        stage_key="fit_analyzed",
                        profile_snapshot_hash=profile_snapshot_hash,
                        job_identity_key=str(job_identity_record.get("key") or ""),
                        job_source_url=job_identity_record.get("source_url"),
                        job_provenance=job_provenance,
                        input_hash=resume_input_hash,
                        output_hash=_sha256_text({"before": base_score, "after": ats_after}),
                    ).to_dict()
                )
                application["stage_envelopes"].append(
                    _build_stage_envelope(
                        application_id=application_id,
                        user_id=str(config.get("user_id") or ""),
                        run_id=run_id,
                        stage_key="resume_tailored",
                        profile_snapshot_hash=profile_snapshot_hash,
                        job_identity_key=str(job_identity_record.get("key") or ""),
                        job_source_url=job_identity_record.get("source_url"),
                        job_provenance=job_provenance,
                        artifact_hash=_sha256_text(tailored_text),
                        artifact_version="tailored-resume-v1",
                        artifact_provenance={"policy_version": "candidate-controlled-v1"},
                        input_hash=resume_input_hash,
                        output_hash=_sha256_text(tailored_text),
                    ).to_dict()
                )

                for envelope in application["stage_envelopes"]:
                    _schedule_db_flush(lambda envelope=envelope: _persist_stage_envelope(envelope))

                # ---- QUALITY GATE (K4, Review Mode) -------------------------
                # Run guardrails on the tailored resume before any submit. A
                # failed gate blocks auto-apply — the package is queued for
                # human approval instead (never auto-submit without consent).
                gate_result = _QUALITY_GATE.check(
                    tailored_text, resume_text, job.get("description")
                )
                application["quality_gate_result"] = gate_result
                application["stage_envelopes"].append(
                    _build_stage_envelope(
                        application_id=application_id,
                        user_id=str(config.get("user_id") or ""),
                        run_id=run_id,
                        stage_key="cover_letter_created",
                        profile_snapshot_hash=profile_snapshot_hash,
                        job_identity_key=str(job_identity_record.get("key") or ""),
                        job_source_url=job_identity_record.get("source_url"),
                        job_provenance=job_provenance,
                        artifact_hash=_sha256_text(cover),
                        artifact_version="cover-letter-v1",
                        artifact_provenance={"policy_version": "grounded-draft-v1"},
                        input_hash=_sha256_text(tailored_text),
                        output_hash=_sha256_text(cover),
                    ).to_dict()
                )
                application["stage_envelopes"].append(
                    _build_stage_envelope(
                        application_id=application_id,
                        user_id=str(config.get("user_id") or ""),
                        run_id=run_id,
                        stage_key="review_package_created",
                        profile_snapshot_hash=profile_snapshot_hash,
                        job_identity_key=str(job_identity_record.get("key") or ""),
                        job_source_url=job_identity_record.get("source_url"),
                        job_provenance=job_provenance,
                        artifact_hash=_sha256_text({"resume": tailored_text, "cover_letter": cover}),
                        artifact_version="review-package-v1",
                        artifact_provenance={"policy_version": "candidate-review-required-v1"},
                        approval_state="pending_review",
                        input_hash=_sha256_text({"resume": tailored_text, "cover_letter": cover}),
                        output_hash=_sha256_text(gate_result),
                    ).to_dict()
                )
                gate_ok = _gate_passed(gate_result)
                review_envelope = application["stage_envelopes"][-1]
                review_envelope["approval_state"] = "pending_review" if gate_ok else "rejected"
                _schedule_db_flush(lambda envelope=review_envelope: _persist_stage_envelope(envelope))
                _log(
                    run_id,
                    "QUALITY_GATE",
                    f"Guardrails {'passed' if gate_ok else 'blocked'} for {job['company']}"
                    + ("" if gate_ok else f" — failed: {_summarize_gate(gate_result)}"),
                )
                if not gate_ok:
                    application["status"] = "gate_blocked"

                # ---- APPLY ---------------------------------------------------
                # Form-field values are a deterministic application payload,
                # never instructions extracted from the ATS page.
                form_fields = job.get("form_fields") or job.get("answers") or {}
                # WS-01 approval gate: submission requires an explicit human
                # approval of THIS exact tailored resume. `auto_apply` in the
                # config is a request, never consent — a stored job_watches row
                # can no longer submit on its own.
                fingerprint = await _queue_approval(
                    config.get("user_id"),
                    run_id,
                    tailored_text,
                    job,
                    cover_letter=cover,
                    form_fields=form_fields,
                )
                application["resume_sha256"] = fingerprint
                approved = await _approval_granted(
                    config.get("user_id"),
                    run_id,
                    fingerprint,
                    job=job,
                    cover_letter=cover,
                    form_fields=form_fields,
                )
                # ---- ATS TIER GATE (P3 / Q8.7) -------------------------------
                # Tier the URL before any submit decision. No major ATS offers a
                # sanctioned third-party submission API; treating Workday and
                # Greenhouse identically forces a choice between over-submitting
                # to hostile portals (ban risk) and under-submitting to friendly
                # ones (lost volume). The tier decides what "approved" may do:
                #   friendly       -> auto-submit when approved (existing flow)
                #   difficult       -> prepare only; never auto-submit (draft)
                #   do_not_submit  -> skip the submit entirely; save the package
                #   unknown vendor -> safe default = prepare only
                job_url = job.get("url")
                tier = _tier_for_url(job_url)
                if _should_skip_ats(job_url):
                    # ponytail: a gate_blocked application must keep its status
                    # — tier skips must not masquerade a blocked resume as skipped.
                    if application["status"] != "gate_blocked":
                        application["status"] = "skipped_ats_tier"
                    _log(
                        run_id,
                        "APPLY",
                        f"SKIPPED: ATS vendor in do_not_submit tier for "
                        f"{job['title']} @ {job['company']} — package saved, "
                        f"not submitted.",
                    )
                    applications.append(application)
                    continue
                if _should_prepare_only(job_url) or tier is None:
                    # ponytail: gate_blocked is the terminal status — keep it;
                    # a blocked resume must not pick up a prepared receipt.
                    is_gate_blocked = application["status"] == "gate_blocked"
                    if not is_gate_blocked:
                        application["status"] = "prepared_ats_difficult"
                    if tier is None:
                        _log(
                            run_id,
                            "APPLY",
                            f"Unknown ATS vendor — treating as difficult for "
                            f"{job['title']} @ {job['company']}",
                        )
                    else:
                        _log(
                            run_id,
                            "APPLY",
                            f"PREPARED ONLY: ATS vendor is difficult — user "
                            f"must submit manually for {job['title']} @ "
                            f"{job['company']}",
                        )
                    if not is_gate_blocked:
                        prepared_receipt = build_prepared_receipt(
                            run_id=run_id,
                            user_id=config.get("user_id"),
                            job=job,
                            resume_text=tailored_text,
                        )
                        await _safe_save_receipt(prepared_receipt)
                        application["receipt"] = {
                            "verified": False,
                            "prepared": True,
                            "confirmation_number": None,
                            "confirmation_text": None,
                            "ats_vendor": prepared_receipt["ats_vendor"],
                        }
                    applications.append(application)
                    continue
                if config.get("auto_apply", False) and gate_ok and not approved:
                    _set_application_lifecycle(application, _LIFECYCLE_REVIEWED)
                    application["status"] = "awaiting_approval"
                    _log(
                        run_id,
                        "APPROVAL",
                        f"Waiting for your approval of the tailored resume for "
                        f"{job['title']} @ {job['company']} — nothing was submitted.",
                    )
                if config.get("auto_apply", False) and gate_ok and approved:
                    # Approval backends may return a previously reviewed decision;
                    # materialize the canonical review edge before confirmation.
                    _set_application_lifecycle(application, _LIFECYCLE_REVIEWED)
                    _set_application_lifecycle(application, _LIFECYCLE_CANDIDATE_CONFIRMED)
                    # The atomic UPDATE ... RETURNING is the only operation that
                    # turns review consent into a one-use server token.
                    try:
                        assert_not_linkedin_automation(job.get("url", ""), "submit")
                    except LinkedInAutomationBlocked:
                        application["status"] = "skipped_linkedin_policy"
                        _log(
                            run_id,
                            "APPLY",
                            f"SKIPPED: LinkedIn automation not permitted by policy (UA §8.2) "
                            f"for {job['title']} @ {job['company']} — save it and submit manually.",
                        )
                        applications.append(application)
                        continue
                    approval_token = await _consume_approval(
                        config.get("user_id"),
                        run_id,
                        fingerprint,
                        job=job,
                        cover_letter=cover,
                        form_fields=form_fields,
                    )
                    guard = None
                    if approval_token:
                        guard = sign_guard(
                            application_fingerprint(
                                user_id=str(config.get("user_id") or ""),
                                run_id=run_id,
                                job=job,
                                resume_text=tailored_text,
                                cover_letter=cover,
                                form_fields=form_fields,
                            ),
                            approval_token,
                        )
                    if not guard:
                        _set_application_lifecycle(application, _LIFECYCLE_REVIEWED)
                        application["status"] = "approval_expired_or_replayed"
                        _log(
                            run_id,
                            "APPROVAL",
                            f"Approval token unavailable or invalid for {job['title']} @ {job['company']} — nothing was submitted.",
                        )
                        applications.append(application)
                        continue
                    try:
                        # WS-02: run the agent for its *evidence*, not a
                        # boolean. The status we write is derived from what the
                        # ATS actually printed — an unconfirmed run stays
                        # "submitted_unverified" instead of quietly becoming
                        # "applied". Self-reported success is the lie this
                        # whole product exists to stop telling.
                        _set_application_lifecycle(application, _LIFECYCLE_APPROVED)
                        _set_application_lifecycle(application, _LIFECYCLE_ATTEMPTED)
                        evidence = Browser.apply_job_with_evidence(
                            job,
                            tailored_text,
                            cover,
                            form_fields=form_fields,
                            submission_guard=guard,
                        )
                        receipt = build_receipt(
                            run_id=run_id,
                            user_id=config.get("user_id"),
                            job=job,
                            resume_text=tailored_text,
                            agent_summary=evidence.get("summary"),
                            agent_actions=evidence.get("actions"),
                            final_url=evidence.get("final_url"),
                            screenshot_b64=evidence.get("screenshot_b64"),
                        )
                        await _safe_save_receipt(receipt)
                        application["receipt"] = {
                            "verified": receipt["verified"],
                            "confirmation_number": receipt["confirmation_number"],
                            "confirmation_text": receipt["confirmation_text"],
                            "ats_vendor": receipt["ats_vendor"],
                        }
                        if receipt["verified"]:
                            _set_application_lifecycle(application, _LIFECYCLE_RECEIPT_CONFIRMED)
                            application["status"] = "applied"
                            _log(
                                run_id,
                                "APPLY",
                                f"Submission CONFIRMED for {job['title']} @ {job['company']}"
                                + (f" (ref {receipt['confirmation_number']})" if receipt["confirmation_number"] else ""),
                            )
                        elif evidence.get("success"):
                            application["status"] = "submitted_unverified"
                            _log(
                                run_id,
                                "APPLY",
                                f"Agent finished {job['title']} @ {job['company']} but the site showed no "
                                f"confirmation — marked unverified so you can check it yourself.",
                            )
                        else:
                            _set_application_lifecycle(application, _LIFECYCLE_FAILED)
                            application["status"] = "apply_failed"
                            # WS-02: a failed run still gets a receipt row so
                            # the UI can render the distinct "Submission failed"
                            # badge — without this a missing receipt is visually
                            # indistinguishable from a pending one.
                            failed_receipt = build_failed_receipt(
                                run_id=run_id,
                                user_id=config.get("user_id"),
                                job=job,
                                resume_text=tailored_text,
                                agent_summary=evidence.get("summary"),
                                error=evidence.get("error"),
                                screenshot_b64=evidence.get("screenshot_b64"),
                            )
                            await _safe_save_receipt(failed_receipt)
                            application["receipt"] = {
                                "verified": False,
                                "failed": True,
                                "confirmation_number": None,
                                "confirmation_text": None,
                                "ats_vendor": failed_receipt["ats_vendor"],
                            }
                            _log(
                                run_id,
                                "APPLY",
                                f"Could not complete the application for {job['company']}: "
                                f"{evidence.get('error') or 'the agent did not reach a submit step'}",
                            )
                    except Exception as exc:
                        logger.error("Auto‑apply failed for %s: %s", job.get("company"), exc)
                        _set_application_lifecycle(application, _LIFECYCLE_FAILED)
                        application["status"] = "apply_failed"
                        failed_receipt = build_failed_receipt(
                            run_id=run_id,
                            user_id=config.get("user_id"),
                            job=job,
                            resume_text=tailored_text,
                            agent_summary=str(exc),
                            error=str(exc),
                        )
                        await _safe_save_receipt(failed_receipt)
                        application["receipt"] = {
                            "verified": False,
                            "failed": True,
                            "confirmation_number": None,
                            "confirmation_text": None,
                            "ats_vendor": failed_receipt["ats_vendor"],
                        }
                        _log(run_id, "APPLY", f"Failed to auto‑apply to {job['company']}: {exc}")


                applications.append(application)
                _log(
                    run_id,
                    "APPLY",
                    f"Application package ready for {job['title']} @ {job['company']} (ATS {ats_after}/100)",
                )
            except Exception as exc:
                logger.error("Autopilot job failed: %s", exc)
                _log(run_id, "ERROR", f"Skipped {job['company']} due to an error, continuing: {exc}")

        if not applications:
            raise ValueError("All application attempts failed - please retry")

        _autopilot_store[run_id]["applications"] = applications
        _update_run(
            run_id,
            status="completed",
            progress=100,
            current_step="DONE",
            applications_created=len(applications),
            completed_at=datetime.now(timezone.utc).isoformat(),
            result={"applications": applications, "applications_created": len(applications)},
        )
        _log(run_id, "DONE", f"Auto‑Pilot finished: {len(applications)} applications prepared & tracked")
    except Exception as exc:
        logger.exception("Autopilot run %s failed", run_id)
        _update_run(run_id, status="failed", current_step="FAILED", error=str(exc))
        _log(run_id, "FAILED", str(exc))


def get_applications(run_id: str) -> list:
    """Return applications generated by a run (cache -> DB)."""
    status = _autopilot_store.get(run_id)
    if status:
        return status.get("applications", [])
    loaded = _read_run_blocking(run_id)
    if loaded:
        _autopilot_store[run_id] = loaded
        return loaded.get("applications", [])
    return []


def get_run_status(run_id: str) -> dict | None:
    """Return run status for polling from Go backend (cache -> DB)."""
    status = _autopilot_store.get(run_id)
    if status:
        return status
    loaded = _read_run_blocking(run_id)
    if loaded:
        _autopilot_store[run_id] = loaded
        return loaded
    return None


# -------------------------------------------------------------------
# Standing Interest Watches & LLM Budget Guards (Mission M15)
# -------------------------------------------------------------------

class StandingWatch(BaseModel):
    user_id: str
    target_role: str
    target_location: str = "Remote"
    salary_floor: float = 100000.0
    schedule_tier: str = "30min"  # "30min" | "6h" | "daily"
    enabled: bool = True
    last_run: Optional[str] = None


VALID_STATUS_TRANSITIONS = {
    "queued": ["prepared", "gate_blocked", "failed"],
    "prepared": ["applied", "rejected", "withdrawn", "failed"],
    "applied": ["phone_screen", "interview", "offer", "rejected", "ghost"],
    "phone_screen": ["interview", "offer", "rejected"],
    "interview": ["offer", "rejected"],
    "offer": ["accepted", "declined"],
    "gate_blocked": ["prepared", "withdrawn"],
    "failed": ["queued", "prepared"],
}


def validate_status_transition(current_stage: str, new_stage: str) -> bool:
    """Validate application status state machine per Mission M15 rules.

    Rejects illegal transitions (e.g. going directly from 'queued' to 'applied' without user confirmation).
    """
    if current_stage == new_stage:
        return True
    allowed = VALID_STATUS_TRANSITIONS.get(current_stage, [])
    return new_stage in allowed


_DAILY_TOKEN_USAGE: Dict[str, int] = {}
DEFAULT_DAILY_LLM_TOKEN_BUDGET = 50000
_DAILY_LLM_BUDGET: OperationBudget | None = None


def check_daily_llm_budget(user_id: str, estimated_tokens: int = 1000) -> bool:
    """Check if the user has remaining daily LLM token budget, keyed by user and UTC date."""
    if estimated_tokens < 0:
        return False
    date_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"{user_id}:{date_key}"
    used = _DAILY_TOKEN_USAGE.get(key, 0)
    if used + estimated_tokens > DEFAULT_DAILY_LLM_TOKEN_BUDGET:
        return False
    _DAILY_TOKEN_USAGE[key] = used + estimated_tokens
    return True


async def check_daily_llm_budget_async(user_id: str, estimated_tokens: int = 1000) -> bool:
    """Consume the AutoPilot daily token budget from the shared quota backend.

    Production refuses admission when Redis is not configured or unavailable;
    development/test environments retain the bounded local fallback used by
    unit tests. The Redis bucket is keyed by user and UTC day and survives
    worker restarts and multiple replicas.
    """
    global _DAILY_LLM_BUDGET
    if not user_id or estimated_tokens < 0:
        return False
    production = os.getenv("ENV", "development").lower() == "production"
    redis_url = os.getenv("REDIS_URL", "").strip()
    if production and not redis_url:
        return False
    if _DAILY_LLM_BUDGET is None:
        _DAILY_LLM_BUDGET = OperationBudget(
            rules={"autopilot_daily_tokens": BudgetRule(DEFAULT_DAILY_LLM_TOKEN_BUDGET, 86_400)},
            redis_url=redis_url or None,
            fail_closed=production,
        )
    try:
        return await _consume_token_budget(user_id, estimated_tokens)
    except OperationBudgetUnavailable:
        return False


async def _consume_token_budget(user_id: str, estimated_tokens: int) -> bool:
    """Consume N token units using an atomic Redis counter when available."""
    budget = _DAILY_LLM_BUDGET
    if budget is None:
        return False
    rule = budget.rules["autopilot_daily_tokens"]
    now = datetime.now(timezone.utc).timestamp()
    bucket = int(now // rule.window_seconds)
    if budget._redis is not None:
        key = f"tayari:op-budget:autopilot_daily_tokens:user:{user_id}:{bucket}"
        try:
            pipe = budget._redis.pipeline(transaction=True)
            pipe.incrby(key, estimated_tokens)
            pipe.expire(key, rule.window_seconds + 1)
            count, _ = await pipe.execute()
            return int(count) <= rule.limit
        except Exception as exc:
            if budget.fail_closed:
                raise OperationBudgetUnavailable("Redis token quota backend unavailable") from exc
    # Development fallback uses the same bounded process-local lock and is
    # intentionally not accepted as production evidence.
    return check_daily_llm_budget(user_id, estimated_tokens)
