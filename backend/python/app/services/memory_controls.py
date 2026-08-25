"""User-controlled correction and retention controls for learned preferences.

All reads and writes are owner-scoped in SQL. The API returns only the bounded
metadata needed for a user to understand and correct a learned signal; it never
returns prompt content, credentials, cookies, or hidden model context.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.services.db import get_pool

_ALLOWED_CONFIDENCE = frozenset({"user_confirmed", "user_inferred", "system_inferred"})


def _iso(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else (str(value) if value else None)


def _row_to_control(row: Any) -> dict[str, Any]:
    item = dict(row)
    item["id"] = str(item["id"])
    item["created_at"] = _iso(item.get("created_at"))
    item["expires_at"] = _iso(item.get("expires_at"))
    item["corrected_at"] = _iso(item.get("corrected_at"))
    return item


async def list_memory_controls(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    """Return newest learned signals for the authenticated owner only."""
    if not user_id:
        return []
    bounded_limit = min(max(int(limit), 1), 200)
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, job_id, job_title, company_name, feedback_type,
                       feedback_source, confidence, is_active, expires_at,
                       corrected_at, created_at
                FROM user_job_feedback
                WHERE user_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT $2
                """,
                uuid.UUID(user_id),
                bounded_limit,
            )
        return [_row_to_control(row) for row in rows]
    except Exception:
        return []


async def update_memory_control(
    user_id: str,
    control_id: str,
    *,
    is_active: bool | None = None,
    confidence: str | None = None,
    expires_at: datetime | None = None,
) -> dict[str, Any] | None:
    """Apply an explicit owner-confirmed correction and return the updated row."""
    if not user_id or not control_id:
        return None
    if confidence is not None and confidence not in _ALLOWED_CONFIDENCE:
        return None
    try:
        control_uuid = uuid.UUID(control_id)
        owner_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE user_job_feedback
                SET is_active = COALESCE($3, is_active),
                    confidence = COALESCE($4, confidence),
                    expires_at = COALESCE($5, expires_at),
                    corrected_at = NOW()
                WHERE id = $1::uuid AND user_id = $2::uuid
                RETURNING id, job_id, job_title, company_name, feedback_type,
                          feedback_source, confidence, is_active, expires_at,
                          corrected_at, created_at
                """,
                control_uuid,
                owner_uuid,
                is_active,
                confidence,
                expires_at,
            )
        return _row_to_control(row) if row else None
    except Exception:
        return None


async def delete_memory_control(user_id: str, control_id: str) -> bool:
    """Delete one learned signal for its owner; no cross-tenant mutation is possible."""
    if not user_id or not control_id:
        return False
    try:
        control_uuid = uuid.UUID(control_id)
        owner_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return False
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM user_job_feedback WHERE id = $1::uuid AND user_id = $2::uuid",
                control_uuid,
                owner_uuid,
            )
        return result.endswith("1")
    except Exception:
        return False
