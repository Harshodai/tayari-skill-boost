"""Centralized asyncpg pool helper for the Python backend.

A single lazily-created asyncpg pool bound to ``DATABASE_URL``. Every caller
(automation_engine, Celery tasks) imports :func:`get_pool` from here so DB
access is guarded in one place. When the database URL is empty or asyncpg is
not installed, :func:`get_pool` returns ``None`` and all DB helpers degrade to
no-ops so keyless/DB-less environments never break.
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.hermes.config import DATABASE_URL

logger = logging.getLogger(__name__)

_pool: Any = None
_pool_checked: bool = False


import asyncio

async def get_pool() -> Any:
    """Return a cached asyncpg pool, or None when unavailable.
    
    Implements exponential backoff retry (5 attempts) to handle
    transient network issues during startup.
    """
    global _pool, _pool_checked
    if _pool_checked:
        return _pool
    
    if not DATABASE_URL:
        logger.info("DATABASE_URL not set — DB persistence disabled")
        _pool_checked = True
        return None
    
    try:
        import asyncpg
    except ImportError:
        logger.warning("asyncpg not installed — DB disabled")
        _pool_checked = True
        return None
    
    for attempt in range(1, 6):  # 5 attempts
        try:
            _pool = await asyncpg.create_pool(
                dsn=DATABASE_URL, 
                min_size=1, 
                max_size=4,
                command_timeout=30,
                server_settings={
                    'jit': 'off',
                    'application_name': 'tayari_ai_engine'
                }
            )
            _pool_checked = True
            logger.info("DB pool connected (attempt %d/5)", attempt)
            return _pool
        except Exception as exc:
            wait = min(2 ** attempt, 30)  # Cap at 30 seconds
            logger.warning(
                "DB pool attempt %d/5 failed: %s. Retrying in %ds...",
                attempt, exc, wait
            )
            await asyncio.sleep(wait)
    
    logger.error("DB pool failed after 5 attempts — running without persistence")
    _pool_checked = True
    return None


def is_db_enabled() -> bool:
    """Return True when a DATABASE_URL is configured (pool may still fail)."""
    return bool(DATABASE_URL)


async def close_pool() -> None:
    """Close the cached pool (used on app/worker shutdown)."""
    global _pool, _pool_checked
    if _pool is not None:
        try:
            await _pool.close()
        except Exception:  # noqa: BLE001
            pass
    _pool = None
    _pool_checked = False


# ---------------------------------------------------------------------------
# agent_runs helpers (shared by Celery tasks + automation_engine)
# Every helper is a no-op when the pool is unavailable.
# ---------------------------------------------------------------------------

VALID_RUN_TYPES = ("autopilot", "scrape", "application_agent", "scheduled")
VALID_STATUSES = ("queued", "running", "completed", "failed", "cancelled")


async def create_agent_run(
    run_id: str,
    user_id: str | None,
    run_type: str,
    config: dict | None = None,
    parent_run_id: str | None = None,
    celery_task_id: str | None = None,
    engine: str | None = None,
) -> bool:
    """Insert an ``agent_runs`` row. Returns False if DB unavailable/fails."""
    if run_type not in VALID_RUN_TYPES:
        logger.warning("app.services.db: invalid run_type %r", run_type)
        return False
    if not user_id:
        # agent_runs.user_id is NOT NULL with an FK to auth.users; skip
        # when no user context is available so the call stays a safe no-op
        # rather than raising a constraint violation.
        logger.debug("app.services.db: create_agent_run skipped (no user_id)")
        return False
    pool = await get_pool()
    if not pool:
        return False
    import json as _json
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO agent_runs
                    (run_id, user_id, run_type, parent_run_id, config,
                     status, progress, logs, screenshots, result,
                     engine, celery_task_id, started_at)
                VALUES ($1, $2, $3, $4, $5::jsonb, 'running', 0,
                        '[]'::jsonb, '[]'::jsonb, '{}'::jsonb,
                        $6, $7, now())
                ON CONFLICT (run_id) DO NOTHING
                """,
                run_id, user_id, run_type, parent_run_id,
                _json.dumps(config or {}), engine, celery_task_id,
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: create_agent_run failed (%s)", exc)
        return False


async def update_agent_run(run_id: str, **fields) -> bool:
    """Update arbitrary columns on an ``agent_runs`` row.

    Known jsonb columns (logs/screenshots/result) are json-encoded; scalars
    are passed through. ``status``/``progress``/``current_step``/``error``
    and timestamps are supported. Unknown keys are ignored.
    """
    if not fields:
        return False
    pool = await get_pool()
    if not pool:
        return False
    import json as _json
    jsonb_cols = {"logs", "screenshots", "result", "config"}
    scalar_cols = {
        "status", "progress", "current_step", "error", "engine",
        "celery_task_id", "started_at", "completed_at", "parent_run_id",
    }
    sets: list[str] = []
    args: list = [run_id]
    idx = 2
    for key, value in fields.items():
        if key in jsonb_cols:
            sets.append(f"{key} = ${idx}::jsonb")
            args.append(_json.dumps(value))
        elif key in scalar_cols:
            sets.append(f"{key} = ${idx}")
            args.append(value)
        else:
            continue
        idx += 1
    if not sets:
        return False
    sets.append("updated_at = now()")
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                f"UPDATE agent_runs SET {', '.join(sets)} WHERE run_id = $1",  # nosec B608 - sets contains only hardcoded allowlisted columns
                *args,
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: update_agent_run failed (%s)", exc)
        return False


async def append_log(run_id: str, step: str, message: str, at: str | None = None) -> bool:
    """Append a log entry to the ``agent_runs.logs`` jsonb array."""
    from datetime import datetime, timezone
    pool = await get_pool()
    if not pool:
        return False
    import json as _json
    entry = {"step": step, "message": message, "at": at or datetime.now(timezone.utc).isoformat()}
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE agent_runs
                SET logs = logs || $2::jsonb,
                    updated_at = now()
                WHERE run_id = $1
                """,
                run_id, _json.dumps([entry]),
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: append_log failed (%s)", exc)
        return False


async def load_agent_run(run_id: str) -> dict | None:
    """Load an ``agent_runs`` row as a dict (jsonb parsed). None if absent/DB off."""
    pool = await get_pool()
    if not pool:
        return None
    import json as _json
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT run_id, user_id, run_type, parent_run_id, config,
                       status, progress, current_step, logs, screenshots,
                       result, error, engine, celery_task_id, started_at,
                       completed_at, created_at, updated_at
                FROM agent_runs WHERE run_id = $1
                """,
                run_id,
            )
            if not row:
                return None
            out = dict(row)
            for k in ("config", "logs", "screenshots", "result"):
                v = out.get(k)
                if isinstance(v, str):
                    out[k] = _json.loads(v)
            return out
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: load_agent_run failed (%s)", exc)
        return None


async def list_agent_runs_for_user(
    user_id: str,
    *,
    run_type: str | None = None,
    statuses: list[str] | None = None,
    limit: int = 50,
) -> list[dict]:
    """Return only runs owned by ``user_id``; fail closed without identity."""
    if not user_id:
        return []
    pool = await get_pool()
    if not pool:
        return []
    import json as _json
    clauses = ["user_id = $1"]
    args: list = [user_id]
    idx = 2
    if run_type:
        clauses.append(f"run_type = ${idx}")
        args.append(run_type)
        idx += 1
    if statuses:
        clauses.append(f"status = ANY(${idx})")
        args.append(list(statuses))
        idx += 1
    args.append(limit)
    query = (
        "SELECT run_id, user_id, run_type, parent_run_id, config, status, "
        "progress, current_step, engine, celery_task_id, started_at, "
        "completed_at, created_at, updated_at FROM agent_runs "
        f"WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ${idx}"
    )
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        result = []
        for row in rows:
            out = dict(row)
            for key in ("config", "logs", "screenshots", "result"):
                value = out.get(key)
                if isinstance(value, str):
                    try:
                        out[key] = _json.loads(value)
                    except (ValueError, TypeError):
                        pass
            result.append(out)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: list_agent_runs_for_user failed (%s)", exc)
        return []


async def load_agent_run_for_user(run_id: str, user_id: str) -> dict | None:
    """Load one run only when it belongs to ``user_id``."""
    if not run_id or not user_id:
        return None
    pool = await get_pool()
    if not pool:
        return None
    import json as _json
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT run_id, user_id, run_type, parent_run_id, config,
                       status, progress, current_step, logs, screenshots,
                       result, error, engine, celery_task_id, started_at,
                       completed_at, created_at, updated_at
                FROM agent_runs WHERE run_id = $1 AND user_id = $2
                """,
                run_id,
                user_id,
            )
        if not row:
            return None
        out = dict(row)
        for key in ("config", "logs", "screenshots", "result"):
            value = out.get(key)
            if isinstance(value, str):
                out[key] = _json.loads(value)
        return out
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: load_agent_run_for_user failed (%s)", exc)
        return None


__all__ = [
    "get_pool",
    "is_db_enabled",
    "close_pool",
    "create_agent_run",
    "update_agent_run",
    "append_log",
    "load_agent_run",
    "list_agent_runs_for_user",
    "load_agent_run_for_user",
]