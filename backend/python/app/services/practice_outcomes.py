"""Consent-gated preparation outcome persistence.

Only bounded progress metadata is stored. Raw answers, transcripts, resumes, and
provider payloads are intentionally outside this service’s contract.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from app.services.db import get_pool

COMPLETION_STATUSES = frozenset({"started", "partial", "completed", "skipped"})
INTERVIEW_OUTCOMES = frozenset({"unknown", "no_interview", "screen", "technical", "onsite", "offer", "rejected"})


def _iso(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else (str(value) if value else None)


def _serialize(row: Any) -> dict[str, Any]:
    item = dict(row)
    item["id"] = str(item["id"])
    item["created_at"] = _iso(item.get("created_at"))
    item["updated_at"] = _iso(item.get("updated_at"))
    item["expires_at"] = _iso(item.get("expires_at"))
    return item


async def record_practice_outcome(user_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    if not user_id or payload.get("consent_acknowledged") is not True:
        return None
    completion_status = str(payload.get("completion_status") or "").strip().lower()
    interview_outcome = str(payload.get("interview_outcome") or "unknown").strip().lower()
    if completion_status not in COMPLETION_STATUSES or interview_outcome not in INTERVIEW_OUTCOMES:
        return None
    try:
        owner_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return None
    pool = await get_pool()
    if not pool:
        return None
    practice_session_id = str(payload.get("practice_session_id") or "").strip()
    if not practice_session_id:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO practice_outcomes
                    (user_id, application_id, practice_session_id, completion_status,
                     confidence, interview_outcome, correction_note,
                     consent_acknowledged, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, LEFT($7, 1000), TRUE, $8)
                RETURNING id, application_id, practice_session_id, completion_status,
                          confidence, interview_outcome, correction_note,
                          consent_acknowledged, expires_at, created_at, updated_at
                """,
                owner_uuid,
                str(payload.get("application_id") or "").strip() or None,
                practice_session_id[:160],
                completion_status,
                int(payload.get("confidence", 0)),
                interview_outcome,
                str(payload.get("correction_note") or "").strip() or None,
                payload.get("expires_at"),
            )
        return _serialize(row) if row else None
    except Exception:
        return None


async def list_practice_outcomes(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    if not user_id:
        return []
    try:
        owner_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return []
    pool = await get_pool()
    if not pool:
        return []
    bounded_limit = min(max(int(limit), 1), 200)
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, application_id, practice_session_id, completion_status,
                       confidence, interview_outcome, correction_note,
                       consent_acknowledged, expires_at, created_at, updated_at
                FROM practice_outcomes
                WHERE user_id = $1::uuid
                  AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY created_at DESC
                LIMIT $2
                """,
                owner_uuid,
                bounded_limit,
            )
        return [_serialize(row) for row in rows]
    except Exception:
        return []
