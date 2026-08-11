"""Human approval gate for autonomous job submissions (WS-01).

Nothing may be submitted to an external ATS on a user's behalf unless that
exact tailored resume was explicitly approved by a human. The gate is keyed on
``sha256(tailored_resume_text)`` so approving one draft never silently
authorises a *different* draft generated later in the same run.

Design rules:
- **Fail closed.** Any error, missing DB, or missing ``user_id`` returns
  ``False``. A gate that cannot verify consent must never grant it.
- **Config cannot grant consent.** ``auto_apply`` stored on a ``job_watches``
  row is not consent; only a row in ``application_approvals`` with
  ``decision='approved'`` is.

All DB access degrades to a no-op when ``DATABASE_URL`` is unset (see
``app.services.db.get_pool``), matching the rest of the Python engine.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any, Optional

from app.services.db import get_pool

logger = logging.getLogger(__name__)

__all__ = ["resume_fingerprint", "is_approved", "request_approval"]


def resume_fingerprint(resume_text: str) -> str:
    """Stable sha256 of the tailored resume that would be submitted.

    Whitespace is normalised so cosmetic reflow does not invalidate an
    approval the user already gave for the same content.
    """
    normalized = " ".join((resume_text or "").split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


async def is_approved(user_id: Optional[str], run_id: str, resume_sha256: str) -> bool:
    """True only when a human approved this exact resume for this run."""
    if not user_id or not run_id or not resume_sha256:
        return False
    try:
        pool = await get_pool()
        if pool is None:
            # No database means no way to verify consent. Fail closed.
            return False
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT decision FROM application_approvals
                 WHERE user_id = $1::uuid AND run_id = $2 AND resume_sha256 = $3
                """,
                user_id,
                run_id,
                resume_sha256,
            )
        return bool(row and row["decision"] == "approved")
    except Exception:  # pragma: no cover - defensive
        logger.exception("approval lookup failed for run %s", run_id)
        return False


async def request_approval(
    user_id: Optional[str],
    run_id: str,
    resume_text: str,
    job: dict[str, Any] | None = None,
) -> Optional[str]:
    """Queue a pending approval and return its fingerprint.

    Idempotent: re-requesting the same resume for the same run leaves the
    existing row (and any decision already made on it) untouched.
    """
    fingerprint = resume_fingerprint(resume_text)
    if not user_id:
        return fingerprint
    job = job or {}
    try:
        pool = await get_pool()
        if pool is None:
            return fingerprint
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO application_approvals
                    (user_id, run_id, job_url, job_title, company,
                     resume_sha256, resume_preview, decision)
                VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'pending')
                ON CONFLICT (user_id, run_id, resume_sha256) DO NOTHING
                """,
                user_id,
                run_id,
                job.get("url"),
                job.get("title"),
                job.get("company"),
                fingerprint,
                (resume_text or "")[:2000],
            )
    except Exception:  # pragma: no cover - defensive
        logger.exception("could not queue approval for run %s", run_id)
    return fingerprint
