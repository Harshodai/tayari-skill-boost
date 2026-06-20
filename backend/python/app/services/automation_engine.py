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
  7. APPLY    - create tracked application packages (auto-applied status)

State model (WS-C): ``_autopilot_store`` remains a read-through in-process cache
for hot polling by the Go backend. State is mirrored to the ``agent_runs``
Postgres table (run_type='autopilot') so runs started in the Celery worker
process are visible to the FastAPI process. ALL DB ops are guarded: when
``DATABASE_URL`` is unset, asyncpg is missing, or no ``user_id`` is known,
persistence degrades to a no-op and the in-memory behavior is unchanged.
NOTE: actual form submission on external job boards is not possible via their public
APIs - the APPLY step produces a complete, tracked application package (tailored
resume + cover letter + apply link) and marks it applied in the tracker.
"""
import asyncio
import concurrent.futures
import logging
import uuid
from datetime import datetime, timezone

from app.services.ats_engine import heuristic_ats_score
from app.services.db import (
    append_log as _db_append_log,
    create_agent_run as _db_create_agent_run,
    load_agent_run as _db_load_agent_run,
    update_agent_run as _db_update_agent_run,
)
from app.services.job_agent import smart_search
from app.services.job_providers import search_jobs
from app.services.llm_service import llm_complete
from app.services.optimizer import optimize_with_reflection

logger = logging.getLogger(__name__)

LETTER_SYSTEM = (
    "You are Tayari's cover letter writer. You write concise, specific, "
    "non-generic cover letters (180-260 words) that connect the candidate's real "
    "achievements to the job. No placeholders like [Company] - use actual names. "
    "Respond with the letter text only."
)

# In-memory read-through store for autopilot runs (Go backend polls these).
# Cache-first; on miss we read from agent_runs and repopulate.
_autopilot_store: dict = {}

# Run ids that already have an agent_runs row inserted (so subsequent updates
# use UPDATE rather than INSERT). Cleared on process restart; safe because
# update_agent_run is a no-op when the row is absent.
_persisted_runs: set = set()

# Single-worker thread executor for blocking async DB reads from sync
# get_run_status/get_applications (which are called from async FastAPI
# endpoints where asyncio.run cannot be nested).
_db_read_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)


def _update_run(run_id: str, **fields):
    """Update the in-process cache and schedule a best-effort async DB flush.

    Sync wrapper: callers inside an event loop (run_autopilot) get the flush
    scheduled via ``loop.create_task``; callers without a loop just update the
    cache (DB stays in sync on the next in-loop call). Unknown keys (e.g.
    ``applications_created``) are ignored by ``update_agent_run``.
    """
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    if run_id in _autopilot_store:
        _autopilot_store[run_id].update(fields)
    _schedule_db_flush(lambda: _persist_run(run_id, **fields))


def _log(run_id: str, step: str, message: str):
    """Append a log entry to the in-process cache and the DB logs jsonb."""
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
    """Schedule an async DB flush on the running loop; no-op if none running.

    Takes a zero-arg factory so the coroutine is only created when it will
    actually be awaited (avoids leaking un-awaited coroutines in sync
    callers). Fire-and-forget: the cache is already updated synchronously, so
    a dropped flush only means the DB row lags behind.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return  # sync caller, no loop - cache-only; DB updated on next flush
    loop.create_task(coro_factory())


async def _persist_run(run_id: str, **fields) -> None:
    """UPSERT the run to ``agent_runs`` (run_type='autopilot').

    Guarded: skipped when the DB pool is unavailable or no ``user_id`` is
    known (agent_runs.user_id is NOT NULL). The first call inserts the row
    via ``create_agent_run``; subsequent calls apply updates.
    """
    store = _autopilot_store.get(run_id, {})
    user_id = store.get("user_id")
    if not user_id:
        return
    if run_id not in _persisted_runs:
        ok = await _db_create_agent_run(
            run_id=run_id, user_id=user_id, run_type="autopilot",
            config=store.get("config") or {}, engine="autopilot",
        )
        if ok:
            _persisted_runs.add(run_id)
    # Strip keys that are not real agent_runs columns; update_agent_run
    # ignores unknown keys, but filter applications_created defensively.
    db_fields = {k: v for k, v in fields.items()
                 if k not in {"applications_created", "updated_at"}}
    if db_fields:
        await _db_update_agent_run(run_id, **db_fields)


async def _load_run(run_id: str) -> dict | None:
    """Read an autopilot run from ``agent_runs`` and map to the store shape.

    Returns ``None`` when the DB is unavailable or the row is absent. The
    ``applications`` list is recovered from the ``result`` jsonb so
    ``get_applications`` can serve cross-process callers.
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
        "applications_created": (result.get("applications_created", 0)
                                 if isinstance(result, dict) else 0),
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


async def _cover_letter(resume_text: str, job: dict, candidate_name: str) -> str:
    user_msg = (
        f"CANDIDATE NAME: {candidate_name}\n"
        f"RESUME:\n{resume_text[:5000]}\n\n"
        f"JOB: {job['title']} at {job['company']}\n"
        f"JOB DESCRIPTION:\n{job.get('description', '')[:2500]}\n\n"
        "Write the cover letter now.")
    return (await llm_complete(LETTER_SYSTEM, user_msg, tier="fast")).strip()


async def run_autopilot(run_id: str, config: dict, profile: dict | None, resume_text: str, candidate_name: str = "Candidate"):
    """Main background pipeline. State mirrored to in-memory cache + agent_runs."""
    config = config or {}
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
        # ---- 1. LOAD ----------------------------------------------------
        _update_run(run_id, status="running", progress=5, current_step="LOAD")
        _log(run_id, "LOAD", "Loading your profile and resume")

        # ---- 2. SEARCH ---------------------------------------------------
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
            _update_run(run_id, progress=10 + i * 8, current_step="SEARCH")
            _log(run_id, "SEARCH",
                       f"Smart-searching jobs for '{title or 'profile-derived role'}'")
            result = await smart_search(title, location, profile, resume_text, top_n=10)
            for j in result["results"]:
                key = (j["title"].lower(), j["company"].lower())
                if key in seen:
                    continue
                seen.add(key)
                all_jobs.append(j)

        # Dream-company targeted hunting: search the boards by company name too
        for company in dream_companies[:3]:
            try:
                batch = await search_jobs(company, location, limit=15)
                hits = [j for j in batch if _is_dream_company(j["company"], [company])]
                added = 0
                for j in hits:
                    key = (j["title"].lower(), j["company"].lower())
                    if key not in seen:
                        seen.add(key)
                        j.setdefault("match_score", None)
                        j.setdefault("matched_skills", [])
                        j.setdefault("missing_skills", [])
                        j.setdefault("match_reason", "Direct dream-company hit")
                        all_jobs.append(j)
                        added += 1
                if added:
                    _log(run_id, "SEARCH",
                               f"Dream-company sweep found {added} open roles at {company}")
            except Exception as exc:
                logger.warning("Dream company sweep failed for %s: %s", company, exc)
        _log(run_id, "SEARCH", f"Found {len(all_jobs)} unique AI-scored jobs")

        # ---- 3. SELECT ---------------------------------------------------
        _update_run(run_id, progress=38, current_step="SELECT")

        # Cross-run dedupe using in-memory store keys
        prior_keys = set()
        for rid, run_data in _autopilot_store.items():
            if rid != run_id and run_data.get("applications"):
                for app in run_data["applications"]:
                    job = app.get("job", {})
                    prior_keys.add((job.get("title", "").lower(), job.get("company", "").lower()))

        before_dedupe = len(all_jobs)
        all_jobs = [j for j in all_jobs
                    if (j["title"].lower(), j["company"].lower()) not in prior_keys]
        if before_dedupe != len(all_jobs):
            _log(run_id, "SELECT",
                       f"Skipped {before_dedupe - len(all_jobs)} jobs you already applied to")

        for j in all_jobs:
            j["is_dream_company"] = _is_dream_company(j["company"], dream_companies)
            base = j.get("match_score") or 50
            j["_priority"] = base + (25 if j["is_dream_company"] else 0)
        all_jobs.sort(key=lambda x: -x["_priority"])
        max_apps = min(int(config.get("max_applications", 3)), 5)
        selected = all_jobs[:max_apps]
        dream_hits = sum(1 for j in selected if j.get("is_dream_company"))
        _log(run_id, "SELECT",
                   f"Selected top {len(selected)} jobs to apply to"
                   + (f" ({dream_hits} at your dream companies)" if dream_hits else ""))
        if not selected:
            raise ValueError("No matching jobs found - try broader job titles")

        # ---- 4-7. TAILOR / SCORE / LETTER / APPLY per job -----------------
        applications = []
        base_score = heuristic_ats_score(resume_text)["score"]
        for idx, job in enumerate(selected):
            frac = 40 + round(55 * idx / len(selected))
            _update_run(run_id, progress=frac, current_step="TAILOR")
            _log(run_id, "TAILOR",
                       f"Tailoring resume for {job['title']} @ {job['company']}")
            try:
                # Reflexion-loop tailoring (generate -> score -> critique -> refine)
                result = await optimize_with_reflection(
                    resume_text,
                    job_description=job.get("description"),
                    job_label=f"{job['title']} at {job['company']}")
                tailored_text = result["optimized_text"]
                ats_after = max(result["new_heuristic_score"],
                                result.get("estimated_score") or 0)
                _log(run_id, "SCORE",
                           f"ATS score for {job['company']}: {base_score} -> {ats_after}"
                           + (" (refined in 2 passes)" if result["refinement_passes"] > 1 else ""))

                _update_run(run_id, current_step="LETTER")
                cover = await _cover_letter(tailored_text, job, candidate_name)
                _log(run_id, "LETTER", f"Cover letter written for {job['company']}")

                application = {
                    "application_id": str(uuid.uuid4()),
                    "job": {k: v for k, v in job.items() if not k.startswith("_")},
                    "tailored_resume_text": tailored_text,
                    "cover_letter": cover,
                    "changes": result.get("changes", []),
                    "keywords_added": result.get("keywords_added", []),
                    "ats_score_before": base_score,
                    "ats_score_after": ats_after,
                    "is_dream_company": job.get("is_dream_company", False),
                    "status": "auto_applied" if config.get("auto_apply", True) else "ready_to_submit",
                    "submission_mode": "assisted",
                    "apply_url": job.get("url", ""),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                applications.append(application)
                _log(run_id, "APPLY",
                           f"Application package ready for {job['title']} @ {job['company']}"
                           f" (ATS {ats_after}/100)")
            except Exception as exc:
                logger.error("Autopilot job failed: %s", exc)
                _log(run_id, "ERROR",
                           f"Skipped {job['company']} due to an error, continuing: {exc}")

        if not applications:
            raise ValueError("All application attempts failed - please retry")

        _autopilot_store[run_id]["applications"] = applications
        _update_run(
            run_id, status="completed", progress=100, current_step="DONE",
            applications_created=len(applications),
            completed_at=datetime.now(timezone.utc).isoformat(),
            result={"applications": applications,
                    "applications_created": len(applications)})
        _log(run_id, "DONE",
                   f"Auto-Pilot finished: {len(applications)} applications prepared & tracked")
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
