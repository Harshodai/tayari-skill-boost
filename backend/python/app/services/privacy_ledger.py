"""Privacy Ledger \u2014 Tayari AI Engine (Task 4.4 / Mission M3).

Every significant AI inference, data access, or external API call that touches
user PII must be recorded here. The ledger is append-only in Postgres and
surfaces in the user-facing Privacy Readiness panel.

Design:
  - Writes to `public.privacy_audit_log` (schema below).
  - Non-blocking: failures are logged but never raise \u2014 the application
    continues regardless of ledger health.
  - An append-only privacy audit ledger of AI inferences and data access
    events, surfaced to users via the Privacy Readiness panel.

SQL (run once, idempotent):

    CREATE TABLE IF NOT EXISTS public.privacy_audit_log (
        id          BIGSERIAL PRIMARY KEY,
        user_id     UUID NOT NULL,
        action      TEXT NOT NULL,          -- 'llm_inference' | 'data_export' | 'hermes_scrape' | ...
        resource    TEXT,                   -- endpoint or service name
        detail      JSONB DEFAULT '{}',     -- structured extra context (sanitised, no raw PII)
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pal_user_created ON public.privacy_audit_log (user_id, created_at DESC);
    ALTER TABLE public.privacy_audit_log ENABLE ROW LEVEL SECURITY;
    CREATE POLICY pal_own ON public.privacy_audit_log
        FOR SELECT USING (auth.uid() = user_id);
    -- Service role can INSERT; users can only SELECT their own rows.

Usage:
    from app.services.privacy_ledger import ledger
    await ledger.record(user_id="...", action="llm_inference", resource="/api/v1/resume/optimize")
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database connection (requires asyncpg; there is no sync psycopg2 fallback —
# if asyncpg isn't installed or DATABASE_URL isn't set, _get_pool() returns
# None and record()/query_user_log() degrade to a no-op, per the
# non-blocking design above)
# ---------------------------------------------------------------------------
_ASYNCPG_AVAILABLE = False
try:
    import asyncpg  # noqa: F401
    _ASYNCPG_AVAILABLE = True
except ImportError:
    pass

_pool: Any = None  # asyncpg pool, lazily initialized
_pool_lock = asyncio.Lock()  # serializes concurrent lazy-init callers onto one pool


async def _get_pool() -> Any:
    """Lazily initialize asyncpg connection pool from DATABASE_URL.

    Guarded by a lock so concurrent first callers (e.g. several requests
    racing on startup) create exactly one pool instead of each opening its
    own and leaking connections.
    """
    global _pool
    if _pool is not None:
        return _pool
    if not _ASYNCPG_AVAILABLE:
        return None
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        return None
    async with _pool_lock:
        if _pool is not None:  # re-check: another caller may have won the race
            return _pool
        try:
            import asyncpg as apg  # noqa: F811
            _pool = await apg.create_pool(db_url, min_size=1, max_size=3, command_timeout=5)
            logger.info("[PrivacyLedger] asyncpg pool created")
        except Exception as exc:
            logger.warning("[PrivacyLedger] Failed to create asyncpg pool: %s", exc)
            _pool = None
    return _pool


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def record(
    *,
    user_id: str,
    action: str,
    resource: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Append one ledger entry. Non-blocking \u2014 failures are swallowed and logged.

    Args:
        user_id:  Authenticated user UUID.
        action:   Event type, e.g. 'llm_inference', 'data_export', 'hermes_scrape',
                  'account_delete', 'cover_letter_generate', 'ats_score'.
        resource: Endpoint or service name, e.g. '/api/v1/resume/optimize'.
        detail:   Sanitised JSONB payload \u2014 never include raw PII like email or resume text.
    """
    try:
        detail_json = json.dumps(detail or {})
    except (TypeError, ValueError) as exc:
        logger.warning(
            "[PrivacyLedger] detail payload not JSON-serializable, dropping entry: "
            "action=%s user=%s resource=%s error=%s", action, user_id, resource, exc
        )
        return
    created_at = datetime.now(timezone.utc)

    pool = await _get_pool()
    if pool is None:
        # Ledger unavailable \u2014 degrade gracefully, log at debug level
        logger.debug(
            "[PrivacyLedger] No DB pool (detail omitted for brevity) \u2014 "
            "action=%s user=%s resource=%s", action, user_id, resource
        )
        return

    sql = """
        INSERT INTO public.privacy_audit_log
            (user_id, action, resource, detail, created_at)
        VALUES ($1, $2, $3, $4::jsonb, $5)
    """
    try:
        async with pool.acquire() as conn:
            await conn.execute(sql, uuid_lib.UUID(user_id), action, resource, detail_json, created_at)
    except Exception as exc:
        logger.warning("[PrivacyLedger] Failed to write ledger entry: %s", exc)


async def query_user_log(user_id: str, limit: int = 50) -> list:
    """
    Fetch the most recent ledger entries for a user.
    Used by the Privacy Readiness panel (/api/v1/privacy/log).
    """
    pool = await _get_pool()
    if pool is None:
        return []
    sql = """
        SELECT id, action, resource, detail, created_at
        FROM public.privacy_audit_log
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, uuid_lib.UUID(user_id), limit)
        return [
            {
                "id": row["id"],
                "action": row["action"],
                "resource": row["resource"],
                "detail": row["detail"],
                "created_at": row["created_at"].isoformat(),
            }
            for row in rows
        ]
    except Exception as exc:
        logger.warning("[PrivacyLedger] Failed to query ledger: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Module-level singleton for import convenience
# ---------------------------------------------------------------------------
class _Ledger:
    """Thin wrapper so callers can do `from app.services.privacy_ledger import ledger`."""

    async def record(self, **kwargs: Any) -> None:
        await record(**kwargs)

    async def query_user_log(self, user_id: str, limit: int = 50) -> list:
        return await query_user_log(user_id, limit)


ledger = _Ledger()
