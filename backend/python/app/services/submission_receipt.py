"""WS-02 — submission receipts.

An "Applied" status is worthless unless something proves the application was
actually submitted. Every other tool in this category lets the user mark a job
"applied" and calls it done; the number in their dashboard is self-reported.

This module turns a browser-agent run into *evidence*: the final screenshot,
the URL the agent ended on, the confirmation text the ATS printed, and the
confirmation/reference number when one exists. When that evidence is absent the
receipt is stored with ``verified = false`` — we never upgrade a hopeful run
into a confirmed submission.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from app.services.db import get_pool

logger = logging.getLogger(__name__)

# Where decoded confirmation screenshots land. Kept on local disk (or a mounted
# volume) rather than the DB so receipts stay cheap to store and serve.
RECEIPT_DIR = os.getenv("RECEIPT_SCREENSHOT_DIR", "/tmp/jobtayari/receipts")

# Phrases an ATS prints once a submission is genuinely recorded. Deliberately
# conservative: matching "we received your application" is proof, matching
# "submit application" (a button label) is not.
_CONFIRMATION_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bthank(?:s| you)[^.\n]{0,40}\bapply(?:ing)?\b",
        r"\bapplication (?:has been |was )?(?:successfully )?(?:submitted|received|sent)\b",
        r"\bwe(?:'ve| have) received your application\b",
        r"\byour application (?:is|has been) (?:complete|submitted|received|on file)\b",
        r"\bsubmission (?:successful|complete|confirmed)\b",
        r"\bapplication confirmation\b",
    )
)

# A reference the user can quote back to the employer.
_CONFIRMATION_NUMBER_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"(?:confirmation|reference|application|requisition|tracking)\s*(?:#|no\.?|number|id)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_]{3,31})",
        r"\bapplication\s+([A-Z]{2,6}-\d{4,12})\b",
    )
)

# Known ATS vendors, detected from the URL the agent finished on. Useful for
# per-vendor success rates later — and for telling the user which system ate
# their application.
_ATS_HOSTS: tuple[tuple[str, str], ...] = (
    ("greenhouse.io", "greenhouse"),
    ("lever.co", "lever"),
    ("myworkdayjobs.com", "workday"),
    ("workday.com", "workday"),
    ("ashbyhq.com", "ashby"),
    ("smartrecruiters.com", "smartrecruiters"),
    ("icims.com", "icims"),
    ("taleo.net", "taleo"),
    ("successfactors.com", "successfactors"),
    ("bamboohr.com", "bamboohr"),
    ("jobvite.com", "jobvite"),
    ("workable.com", "workable"),
    ("recruitee.com", "recruitee"),
    ("linkedin.com", "linkedin"),
    ("usajobs.gov", "usajobs"),
)


def detect_ats_vendor(url: str | None) -> str | None:
    """Return a known ATS vendor slug for ``url``, or None.

    Matches the URL's hostname against each registered host suffix: an exact
    host match OR a dot-boundary subdomain (``host.endswith("." + suffix)``).
    Occurrences in paths, queries, or lookalike domains (e.g.
    ``evil-greenhouse.io``) do not match.
    """
    if not url:
        return None
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        host = (parsed.hostname or "").lower()
    except Exception:
        return None
    if not host:
        return None
    for suffix, vendor in _ATS_HOSTS:
        if host == suffix or host.endswith("." + suffix):
            return vendor
    return None


def detect_confirmation(*texts: str | None) -> tuple[bool, str | None, str | None]:
    """Inspect agent output for proof of submission.

    Returns ``(verified, confirmation_text, confirmation_number)``. ``verified``
    is True only when an explicit confirmation phrase was found — the presence
    of a confirmation number alone is not enough, since requisition IDs appear
    on job descriptions too.
    """
    blob = "\n".join(t for t in texts if t)
    if not blob:
        return False, None, None

    confirmation_text: str | None = None
    for pattern in _CONFIRMATION_PATTERNS:
        match = pattern.search(blob)
        if match:
            # Keep a little surrounding context so the user can judge it too.
            start = max(0, match.start() - 60)
            end = min(len(blob), match.end() + 60)
            confirmation_text = " ".join(blob[start:end].split())
            break

    confirmation_number: str | None = None
    for pattern in _CONFIRMATION_NUMBER_PATTERNS:
        match = pattern.search(blob)
        if match:
            confirmation_number = match.group(1).strip()
            break

    return confirmation_text is not None, confirmation_text, confirmation_number


def store_screenshot(run_id: str, screenshot_b64: str | None) -> str | None:
    """Decode and persist a base64 screenshot, returning its path.

    Failures are non-fatal: a receipt without a screenshot is still a receipt.
    """
    if not screenshot_b64:
        return None
    try:
        payload = screenshot_b64.split(",", 1)[-1]  # tolerate data: URLs
        raw = base64.b64decode(payload, validate=False)
    except (binascii.Error, ValueError) as exc:
        logger.warning("submission_receipt: undecodable screenshot for %s (%s)", run_id, exc)
        return None
    try:
        os.makedirs(RECEIPT_DIR, exist_ok=True)
        path = os.path.join(RECEIPT_DIR, f"{run_id}-{uuid.uuid4().hex[:8]}.png")
        with open(path, "wb") as handle:
            handle.write(raw)
        return path
    except OSError as exc:
        logger.warning("submission_receipt: could not write screenshot (%s)", exc)
        return None


def resume_fingerprint(resume_text: str | None) -> str | None:
    """SHA256 of the exact resume text that was submitted."""
    if not resume_text:
        return None
    return hashlib.sha256(resume_text.encode("utf-8")).hexdigest()


def build_receipt(
    *,
    run_id: str,
    user_id: str | None,
    job: dict,
    resume_text: str | None,
    agent_summary: str | None,
    agent_actions: list[str] | None = None,
    final_url: str | None = None,
    screenshot_b64: str | None = None,
    answers: dict | None = None,
) -> dict[str, Any]:
    """Assemble a receipt dict from a finished agent run. Pure — no I/O except
    writing the screenshot to disk."""
    verified, confirmation_text, confirmation_number = detect_confirmation(
        agent_summary, "\n".join(agent_actions or [])
    )
    landed_url = final_url or job.get("url")
    return {
        "run_id": run_id,
        "user_id": user_id,
        "job_url": job.get("url"),
        "job_title": job.get("title"),
        "company": job.get("company"),
        "ats_vendor": detect_ats_vendor(landed_url),
        "submitted_at": datetime.now(timezone.utc) if verified else None,
        "verified": verified,
        "confirmation_text": confirmation_text,
        "confirmation_number": confirmation_number,
        "screenshot_path": store_screenshot(run_id, screenshot_b64),
        "submitted_resume_sha256": resume_fingerprint(resume_text),
        # Q8.5: the SHA256 is a fingerprint, not an artifact. Store the full
        # submitted resume text so the user can prove exactly what was sent on
        # their behalf — a hash alone is not reconstructable evidence.
        "submitted_resume_text": resume_text,
        "answers": answers or {},
        "outcome": "submitted" if verified else "unconfirmed",
    }


# Approved, user-safe failure messages keyed by category. No portion of the
# raw error or agent_summary is ever persisted — detailed diagnostics live
# only in server logs (the receipt's ``_error`` field, which is NOT
# persisted by save_receipt). Categories are matched against the raw error
# string; unknown errors get the generic fallback.
_FAILURE_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("linkedin_automation_blocked", "LinkedIn automation is not permitted by policy. Save the job and submit manually."),
    ("linkedin", "LinkedIn automation is not permitted by policy. Save the job and submit manually."),
    ("no_job_url", "No application URL was provided, so nothing could be submitted."),
    ("blockedbyclient", "The site blocked the automated browser. Open the posting and submit manually."),
    ("timeout", "The application step timed out. Try again, or submit manually."),
    ("timed out", "The application step timed out. Try again, or submit manually."),
    ("navigation", "The browser could not reach the application page. Check the URL and retry."),
    ("auth", "The application required a login the agent could not provide. Submit manually."),
    ("captcha", "The application presented a CAPTCHA the agent could not solve. Submit manually."),
    ("rate", "A rate limit was hit. Wait a moment and retry."),
    ("network", "A network error interrupted the application. Retry, or submit manually."),
    ("ai_service_unavailable", "The AI engine was not available, so the application could not be prepared."),
    ("llm_not_configured", "The AI engine was not configured, so the application could not be prepared."),
)
_FAILURE_FALLBACK = "The application could not be completed automatically. Open the posting and submit manually."


def _classify_failure_reason(error: str | None, agent_summary: str | None) -> str:
    """Map a raw error/summary to an approved user-safe failure message.

    No portion of ``error``/``agent_summary`` is returned — only approved
    strings. Category matching is case-insensitive substring on the raw
    diagnostic (used for classification only, never persisted).
    """
    diag = (error or agent_summary or "").lower()
    if not diag:
        return _FAILURE_FALLBACK
    for needle, message in _FAILURE_CATEGORIES:
        if needle in diag:
            return message
    return _FAILURE_FALLBACK


def build_failed_receipt(
    *,
    run_id: str,
    user_id: str | None,
    job: dict,
    resume_text: str | None,
    agent_summary: str | None = None,
    error: str | None = None,
    screenshot_b64: str | None = None,
    answers: dict | None = None,
) -> dict[str, Any]:
    """Assemble a receipt for a run that died before reaching submit.

    A failed run must still leave a receipt row — otherwise a missing receipt
    is visually indistinguishable from a pending one (audit Q8.2 / WS-02).
    `verified` is always False; `outcome` is 'failed' so the UI can render the
    distinct "Submission failed" badge.

    ``failure_reason`` is an allowlisted, user-safe message — never the raw
    error or agent_summary (not even sanitized/truncated). The raw diagnostic
    is retained under ``_error`` for server-side logs only; ``save_receipt``
    does NOT persist ``_error``.
    """
    reason = _classify_failure_reason(error, agent_summary)
    return {
        "run_id": run_id,
        "user_id": user_id,
        "job_url": job.get("url"),
        "job_title": job.get("title"),
        "company": job.get("company"),
        "ats_vendor": detect_ats_vendor(job.get("url")),
        "submitted_at": None,
        "verified": False,
        "confirmation_text": None,
        "confirmation_number": None,
        "screenshot_path": store_screenshot(run_id, screenshot_b64),
        "submitted_resume_sha256": resume_fingerprint(resume_text),
        "submitted_resume_text": resume_text,
        "answers": answers or {},
        "outcome": "failed",
        "failure_reason": reason,
        "_error": error or (agent_summary or "the agent did not reach a submit step"),
    }


def build_prepared_receipt(
    *,
    run_id: str,
    user_id: str | None,
    job: dict,
    resume_text: str | None,
    answers: dict | None = None,
) -> dict[str, Any]:
    """Assemble a receipt for a difficult-tier job that was prepped, not submitted.

    Audit Q8.7 / P3: a difficult-tier ATS (Workday, SmartRecruiters, iCIMS,
    Taleo, SuccessFactors) is never auto-submitted even with approval — the
    user submits manually. We still record a receipt row so the package is
    visible as "prepared, awaiting manual submit" rather than vanishing.
    `verified` is always False; `outcome` is 'prepared'.

    Prepared receipts must never populate the submitted_resume_* fields — the
    resume was not submitted, and a populated submitted_* fingerprint would
    claim it was. The prepared resume rides under prepared_resume_* (held in
    the dict only; save_receipt persists just the submitted_* columns, so the
    DB row keeps them null).
    """
    return {
        "run_id": run_id,
        "user_id": user_id,
        "job_url": job.get("url"),
        "job_title": job.get("title"),
        "company": job.get("company"),
        "ats_vendor": detect_ats_vendor(job.get("url")),
        "submitted_at": None,
        "verified": False,
        "confirmation_text": None,
        "confirmation_number": None,
        "screenshot_path": None,
        "submitted_resume_sha256": None,
        "submitted_resume_text": None,
        "prepared_resume_sha256": resume_fingerprint(resume_text),
        "prepared_resume_text": resume_text,
        "answers": answers or {},
        "outcome": "prepared",
    }


async def save_receipt(receipt: dict[str, Any]) -> bool:
    """Persist a receipt. Degrades to a no-op when no database is configured."""
    pool = await get_pool()
    if not pool:
        logger.info("submission_receipt: no DB pool, receipt not persisted")
        return False
    if not receipt.get("user_id"):
        # user_id is NOT NULL and RLS-scoped; an ownerless receipt is unusable.
        logger.warning("submission_receipt: skipping receipt with no user_id")
        return False
    try:
        # ponytail: no failure_reason column exists in submission_receipts —
        # persist it under the reserved answers key so the reason survives
        # storage/retrieval via the jsonb without a schema migration. The
        # receipt dict itself stays clean (failure_reason is a top-level key).
        persist_answers = dict(receipt.get("answers") or {})
        if receipt.get("outcome") == "failed" and receipt.get("failure_reason"):
            persist_answers["_failure_reason"] = receipt["failure_reason"]
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO submission_receipts
                    (user_id, run_id, job_url, job_title, company, ats_vendor,
                     submitted_at, verified, confirmation_text, confirmation_number,
                     screenshot_path, submitted_resume_sha256, submitted_resume_text,
                     answers, outcome)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
                """,
                receipt["user_id"],
                receipt.get("run_id"),
                receipt.get("job_url"),
                receipt.get("job_title"),
                receipt.get("company"),
                receipt.get("ats_vendor"),
                receipt.get("submitted_at"),
                bool(receipt.get("verified")),
                receipt.get("confirmation_text"),
                receipt.get("confirmation_number"),
                receipt.get("screenshot_path"),
                receipt.get("submitted_resume_sha256"),
                receipt.get("submitted_resume_text"),
                json.dumps(persist_answers),
                receipt.get("outcome") or "unknown",
            )
        return True
    except Exception as exc:  # noqa: BLE001 — persistence must never break a run
        logger.warning("submission_receipt: save failed (%s)", exc)
        return False
