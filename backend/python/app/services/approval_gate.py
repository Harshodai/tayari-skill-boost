"""Human approval gate for autonomous job submissions.

A submission is authorised only when the same user approved the same run, the
same normalized job URL, and the same tailored resume. Approval expires and is
consumed atomically immediately before the browser submit step.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any, Optional
from urllib.parse import urlsplit, urlunsplit

from app.services.db import get_pool

logger = logging.getLogger(__name__)

__all__ = ["resume_fingerprint", "job_fingerprint", "is_approved", "request_approval"]


def resume_fingerprint(resume_text: str) -> str:
    """Stable sha256 of the tailored resume content."""
    normalized = " ".join((resume_text or "").split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def job_fingerprint(job_url: str) -> str:
    """Hash a normalized HTTP(S) job URL without fragment or cosmetic casing."""
    raw = (job_url or "").strip()
    parsed = urlsplit(raw)
    normalized = urlunsplit(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path or "/",
            parsed.query,
            "",
        )
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


async def is_approved(
    user_id: Optional[str],
    run_id: str,
    resume_sha256: str,
    job: dict[str, Any] | None = None,
    *,
    consume: bool = False,
) -> bool:
    """Check or atomically consume approval for one exact application target."""
    job_url = (job or {}).get("url")
    if not user_id or not run_id or not resume_sha256 or not job_url:
        return False

    job_sha256 = job_fingerprint(str(job_url))
    try:
        pool = await get_pool()
        if pool is None:
            return False
        async with pool.acquire() as conn:
            if consume:
                row = await conn.fetchrow(
                    """
                    UPDATE application_approvals
                       SET decision = 'consumed', consumed_at = NOW(), updated_at = NOW()
                     WHERE user_id = $1::uuid
                       AND run_id = $2
                       AND resume_sha256 = $3
                       AND job_url_sha256 = $4
                       AND decision = 'approved'
                       AND consumed_at IS NULL
                       AND expires_at > NOW()
                    RETURNING id
                    """,
                    user_id,
                    run_id,
                    resume_sha256,
                    job_sha256,
                )
                return row is not None

            row = await conn.fetchrow(
                """
                SELECT id
                  FROM application_approvals
                 WHERE user_id = $1::uuid
                   AND run_id = $2
                   AND resume_sha256 = $3
                   AND job_url_sha256 = $4
                   AND decision = 'approved'
                   AND consumed_at IS NULL
                   AND expires_at > NOW()
                """,
                user_id,
                run_id,
                resume_sha256,
                job_sha256,
            )
        return row is not None
    except Exception:  # pragma: no cover - defensive fail-closed path
        logger.exception("approval lookup failed for run %s", run_id)
        return False


async def request_approval(
    user_id: Optional[str],
    run_id: str,
    resume_text: str,
    job: dict[str, Any] | None = None,
) -> Optional[str]:
    """Queue a pending approval bound to the exact job and resume."""
    fingerprint = resume_fingerprint(resume_text)
    job = job or {}
    job_url = (job.get("url") or "").strip()
    if not user_id or not job_url:
        return fingerprint

    try:
        pool = await get_pool()
        if pool is None:
            return fingerprint
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO application_approvals
                    (user_id, run_id, job_url, job_title, company,
                     resume_sha256, resume_preview, job_url_sha256, decision,
                     expires_at)
                VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW() + INTERVAL '15 minutes')
                ON CONFLICT (user_id, run_id, resume_sha256) DO UPDATE
                    SET job_url = EXCLUDED.job_url,
                        job_title = EXCLUDED.job_title,
                        company = EXCLUDED.company,
                        resume_preview = EXCLUDED.resume_preview,
                        job_url_sha256 = EXCLUDED.job_url_sha256,
                        expires_at = EXCLUDED.expires_at,
                        updated_at = NOW()
                    WHERE application_approvals.decision = 'pending'
                """,
                user_id,
                run_id,
                job_url,
                job.get("title"),
                job.get("company"),
                fingerprint,
                (resume_text or "")[:2000],
                job_fingerprint(job_url),
            )
    except Exception:  # pragma: no cover - defensive
        logger.exception("could not queue approval for run %s", run_id)
    return fingerprint
