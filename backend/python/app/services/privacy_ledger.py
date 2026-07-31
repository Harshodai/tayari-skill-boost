"""Privacy Ledger \u2014 Tayari AI Engine (Task 4.4 / Mission M3).

Every significant AI inference, data access, or external API call that touches
user PII must be recorded here. The ledger is append-only in Postgres and
surfaces in the user-facing Privacy Readiness panel.

Design:
  - Writes to `public.privacy_audit_log` (schema below).
  - Non-blocking: failures are logged but never raise \u2014 the application
    continues regardless of ledger health.
  - Complies with GDPR Article 30 (Records of Processing Activities).

SQL (run once, idempotent):

    CREATE TABLE IF NOT EXISTS public.privacy_audit_log (
        id          BIGSERIAL PRIMARY KEY,
        user_id     UUID NOT NULL,
        action      TEXT NOT NULL,          -- 'llm_inference' | 'data_export' | 'hermes_scrape' | ...
        resource    TEXT,                   -- endpoint or service name
        detail      JSONB DEFAULT '{}',     -- structured extra context (sanitised, no raw PII)
        ip_hash     TEXT,                   -- SHA-256 of client IP (never store raw IP)
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
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database connection (async asyncpg preferred, falls back to sync psycopg2)
# ---------------------------------------------------------------------------
_ASYNCPG_AVAILABLE = False
try:
    import asyncpg  # noqa: F401
    _ASYNCPG_AVAILABLE = True
except ImportError:
    pass

_pool: Any = None  # asyncpg pool, lazily initialized


async def _get_pool() -> Any:
    """Lazily initialize asyncpg connection pool from DATABASE_URL."""
    global _pool
    if _pool is not None:
        return _pool
    if not _ASYNCPG_AVAILABLE:
        return None
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        return None
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

def hash_ip(ip: Optional[str]) -> Optional[str]:
    """Return SHA-256 hex of the IP address \u2014 store hash, never raw IP."""
    if not ip:
        return None
    return hashlib.sha256(ip.encode()).hexdigest()


async def record(
    *,
    user_id: str,
    action: str,
    resource: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
    ip: Optional[str] = None,
) -> None:
    """
    Append one ledger entry. Non-blocking \u2014 failures are swallowed and logged.

    Args:
        user_id:  Authenticated user UUID.
        action:   Event type, e.g. 'llm_inference', 'data_export', 'hermes_scrape',
                  'account_delete', 'cover_letter_generate', 'ats_score'.
        resource: Endpoint or service name, e.g. '/api/v1/resume/optimize'.
        detail:   Sanitised JSONB payload \u2014 never include raw PII like email or resume text.
        ip:       Raw client IP (will be hashed before storage).
    """
    ip_hash = hash_ip(ip)
    detail_json = json.dumps(detail or {})
    created_at = datetime.now(timezone.utc).isoformat()

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
            (user_id, action, resource, detail, ip_hash, created_at)
        VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6::timestamptz)
    """
    try:
        async with pool.acquire() as conn:
            await conn.execute(sql, user_id, action, resource, detail_json, ip_hash, created_at)
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
        WHERE user_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT $2
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, user_id, limit)
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
