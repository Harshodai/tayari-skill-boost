"""Append-only user feedback event log for preference learning.

The ``user_job_feedback`` table (migration ``20260629000002_add_user_feedback.sql``)
is the single sink for preference signals — liked / disliked / applied / skipped /
saved. This module is the thin writer every feedback path routes through (SRP:
one guard, one place that validates ``feedback_type`` and normalizes metadata).

No-op when the DB pool is unavailable so callers (routes, middleware hooks) can
fire-and-forget without branching.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Optional

from app.services.db import get_pool

logger = logging.getLogger(__name__)

# ponytail: mirror the DB CHECK constraint here so we reject bad signals before
# a round-trip. Add a feedback type in one place (here + the migration).
VALID_FEEDBACK_TYPES = frozenset({"liked", "disliked", "applied", "skipped", "saved"})
VALID_FEEDBACK_SOURCES = frozenset({"manual", "auto_detected"})


async def log_feedback_event(
    user_id: str,
    job_id: str,
    feedback_type: str,
    job_title: Optional[str] = None,
    company_name: Optional[str] = None,
    feedback_source: str = "manual",
    metadata: Optional[dict[str, Any]] = None,
) -> bool:
    """Append a feedback row. Returns False if DB unavailable / invalid / fails."""
    if feedback_type not in VALID_FEEDBACK_TYPES:
        logger.warning("event_log: invalid feedback_type %r", feedback_type)
        return False
    if feedback_source not in VALID_FEEDBACK_SOURCES:
        feedback_source = "manual"
    if not user_id or not job_id:
        return False

    pool = await get_pool()
    if not pool:
        return False

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_job_feedback
                    (user_id, job_id, job_title, company_name,
                     feedback_type, feedback_source, metadata)
                VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)
                """,
                uuid.UUID(user_id),
                job_id,
                job_title,
                company_name,
                feedback_type,
                feedback_source,
                json.dumps(metadata or {}),
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("event_log: log_feedback_event failed (%s)", exc)
        return False


async def list_feedback_events(
    user_id: str,
    feedback_type: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """Read back a user's feedback events (newest first). Empty list if DB off."""
    if not user_id:
        return []
    pool = await get_pool()
    if not pool:
        return []
    limit = min(max(1, limit), 500)
    try:
        async with pool.acquire() as conn:
            if feedback_type:
                rows = await conn.fetch(
                    """
                    SELECT job_id, job_title, company_name, feedback_type,
                           feedback_source, metadata, created_at
                    FROM user_job_feedback
                    WHERE user_id = $1::uuid AND feedback_type = $2
                    ORDER BY created_at DESC LIMIT $3
                    """,
                    uuid.UUID(user_id),
                    feedback_type,
                    limit,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT job_id, job_title, company_name, feedback_type,
                           feedback_source, metadata, created_at
                    FROM user_job_feedback
                    WHERE user_id = $1::uuid
                    ORDER BY created_at DESC LIMIT $2
                    """,
                    uuid.UUID(user_id),
                    limit,
                )
        out = []
        for r in rows:
            d = dict(r)
            meta = d.get("metadata")
            if isinstance(meta, str):
                d["metadata"] = json.loads(meta)
            d["created_at"] = d["created_at"].isoformat() if hasattr(d["created_at"], "isoformat") else str(d["created_at"])
            out.append(d)
        return out
    except Exception as exc:  # noqa: BLE001
        logger.warning("event_log: list_feedback_events failed (%s)", exc)
        return []