"""Centralized asyncpg pool helper for the Python backend.

A single lazily-created asyncpg pool bound to ``DATABASE_URL``. Every caller
(automation_engine, Celery tasks) imports :func:`get_pool` from here so DB
access is guarded in one place. When the database URL is empty or asyncpg is
not installed, :func:`get_pool` returns ``None`` and all DB helpers degrade to
no-ops so keyless/DB-less environments never break.
"""
from __future__ import annotations

import json as _json
import logging
from typing import Any

from app.services.hermes.config import DATABASE_URL

logger = logging.getLogger(__name__)

_pool: Any = None
_pool_checked: bool = False
_pool_loop: Any = None


import asyncio

async def get_pool() -> Any:
    """Return a cached asyncpg pool, or None when unavailable.
    
    Implements exponential backoff retry (5 attempts) to handle
    transient network issues during startup.
    """
    global _pool, _pool_checked, _pool_loop
    current_loop = asyncio.get_running_loop()
    if _pool_checked and _pool_loop is current_loop:
        return _pool

    # asyncpg pools are bound to the event loop that created them. Test
    # harnesses, reloaders, and worker lifecycle boundaries can legitimately
    # create a new loop; never hand a stale pool across that boundary.
    if _pool is not None and _pool_loop is not current_loop:
        try:
            await _pool.close()
        except Exception:  # noqa: BLE001 - stale-loop cleanup is best effort
            pass
        _pool = None
    _pool_checked = False
    _pool_loop = current_loop
    
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
            _pool_loop = current_loop
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
    _pool_loop = current_loop
    return None


def is_db_enabled() -> bool:
    """Return True when a DATABASE_URL is configured (pool may still fail)."""
    return bool(DATABASE_URL)


async def close_pool() -> None:
    """Close the cached pool (used on app/worker shutdown)."""
    global _pool, _pool_checked, _pool_loop
    if _pool is not None:
        try:
            await _pool.close()
        except Exception:  # noqa: BLE001
            pass
    _pool = None
    _pool_checked = False
    _pool_loop = None


# ---------------------------------------------------------------------------
# agent_runs helpers (shared by Celery tasks + automation_engine)
# Every helper is a no-op when the pool is unavailable.
# ---------------------------------------------------------------------------

VALID_RUN_TYPES = ("autopilot", "scrape", "application_agent", "scheduled")
VALID_STATUSES = ("queued", "running", "completed", "failed", "cancelled")
HITL_STATES = (
    "queued", "preparing", "needs_browser_handoff", "needs_user_login",
    "needs_otp_or_mfa", "needs_captcha", "needs_terms_review",
    "needs_sensitive_answer", "ready_for_final_review", "user_approved",
    "submitting", "submitted_verified", "submitted_unverified",
    "submission_failed", "paused", "cancelled",
)
ALLOWED_HITL_TRANSITIONS = {
    "queued": {"preparing", "cancelled", "paused"},
    "preparing": {
        "needs_browser_handoff", "needs_user_login", "needs_otp_or_mfa",
        "needs_captcha", "needs_terms_review", "needs_sensitive_answer",
        "ready_for_final_review", "submission_failed", "paused", "cancelled",
    },
    "needs_browser_handoff": {"preparing", "paused", "cancelled"},
    "needs_user_login": {"preparing", "paused", "cancelled"},
    "needs_otp_or_mfa": {"preparing", "paused", "cancelled"},
    "needs_captcha": {"preparing", "paused", "cancelled"},
    "needs_terms_review": {"ready_for_final_review", "paused", "cancelled"},
    "needs_sensitive_answer": {"preparing", "ready_for_final_review", "paused", "cancelled"},
    "ready_for_final_review": {"user_approved", "paused", "cancelled"},
    "user_approved": {"submitting", "paused", "cancelled"},
    "submitting": {"submitted_verified", "submitted_unverified", "submission_failed", "paused"},
    "paused": {"preparing", "cancelled"},
    "submitted_verified": set(),
    "submitted_unverified": {"paused", "cancelled"},
    "submission_failed": {"preparing", "paused", "cancelled"},
    "cancelled": set(),
}


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
                     engine, celery_task_id, handoff_state, started_at)
                VALUES ($1, $2, $3, $4, $5::jsonb, 'running', 0,
                        '[]'::jsonb, '[]'::jsonb, '{}'::jsonb,
                        $6, $7, 'preparing', now())
                ON CONFLICT (run_id) DO NOTHING
                """,
                run_id, user_id, run_type, parent_run_id,
                _json.dumps(config or {}), engine, celery_task_id,
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: create_agent_run failed (%s)", exc)
        return False


async def transition_agent_run_for_user(
    run_id: str,
    user_id: str,
    target_state: str,
    *,
    expected_state: str | None = None,
    expected_version: int | None = None,
    handoff_token_hash: str | None = None,
    handoff_expires_at: Any = None,
) -> bool:
    """Atomically transition an owned run, rejecting stale or invalid updates."""
    if not user_id or not run_id or target_state not in HITL_STATES:
        return False
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT handoff_state, state_version FROM agent_runs WHERE run_id = $1 AND user_id = $2",
                run_id,
                user_id,
            )
            if not row:
                return False
            current = row["handoff_state"] or "queued"
            if target_state not in ALLOWED_HITL_TRANSITIONS.get(current, set()):
                return False
            if expected_state is not None and current != expected_state:
                return False
            if expected_version is not None and row["state_version"] != expected_version:
                return False
            updated = await conn.execute(
                """
                UPDATE agent_runs
                SET handoff_state = $3,
                    state_version = state_version + 1,
                    status = CASE
                        WHEN $3 IN ('submitted_verified', 'submitted_unverified') THEN 'completed'
                        WHEN $3 IN ('submission_failed', 'cancelled') THEN $3
                        ELSE status
                    END,
                    handoff_token_hash = $4,
                    handoff_expires_at = $5,
                    updated_at = now()
                WHERE run_id = $1 AND user_id = $2 AND state_version = $6
                """,
                run_id,
                user_id,
                target_state,
                handoff_token_hash,
                handoff_expires_at,
                row["state_version"],
            )
            return updated.endswith("1")
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: transition_agent_run_for_user failed (%s)", exc)
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
    from datetime import datetime
    jsonb_cols = {"logs", "screenshots", "result", "config"}
    timestamp_cols = {"started_at", "completed_at", "handoff_expires_at"}
    scalar_cols = {
        "status", "progress", "current_step", "error", "engine",
        "celery_task_id", "parent_run_id",
        "handoff_state", "handoff_token_hash", "state_version",
    }
    sets: list[str] = []
    args: list = [run_id]
    idx = 2
    for key, value in fields.items():
        if key in jsonb_cols:
            sets.append(f"{key} = ${idx}::jsonb")
            args.append(_json.dumps(value))
        elif key in timestamp_cols:
            sets.append(f"{key} = ${idx}")
            if isinstance(value, str):
                try:
                    value = datetime.fromisoformat(value)
                except Exception:
                    pass
            args.append(value)
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


async def persist_application_stage_envelope(envelope: dict) -> bool:
    """Persist one bounded M9-01 stage envelope idempotently.

    The schema is additive; an unavailable/older database returns False rather
    than changing the user-visible workflow result. The envelope builder is
    responsible for excluding raw resume/job/provider content before this call.
    """
    required = ("application_id", "user_id", "stage_key", "stage_version")
    if any(not envelope.get(key) for key in required):
        return False
    pool = await get_pool()
    if not pool:
        return False
    import json as _json
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO application_stage_envelopes (
                    application_id, run_id, user_id, tenant_id, stage_key,
                    stage_version, profile_snapshot_hash, job_identity_key,
                    job_source_url, job_provenance, artifact_hash,
                    artifact_version, artifact_provenance, approval_state,
                    failure_state, input_hash, output_hash, observed_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
                    $11, $12, $13::jsonb, $14, $15::jsonb, $16, $17, $18
                )
                ON CONFLICT (application_id, stage_key, stage_version)
                DO UPDATE SET
                    run_id = EXCLUDED.run_id,
                    tenant_id = EXCLUDED.tenant_id,
                    profile_snapshot_hash = EXCLUDED.profile_snapshot_hash,
                    job_identity_key = EXCLUDED.job_identity_key,
                    job_source_url = EXCLUDED.job_source_url,
                    job_provenance = EXCLUDED.job_provenance,
                    artifact_hash = EXCLUDED.artifact_hash,
                    artifact_version = EXCLUDED.artifact_version,
                    artifact_provenance = EXCLUDED.artifact_provenance,
                    approval_state = EXCLUDED.approval_state,
                    failure_state = EXCLUDED.failure_state,
                    input_hash = EXCLUDED.input_hash,
                    output_hash = EXCLUDED.output_hash,
                    observed_at = EXCLUDED.observed_at,
                    updated_at = now()
                WHERE application_stage_envelopes.user_id = EXCLUDED.user_id
                """,
                envelope["application_id"],
                envelope.get("run_id"),
                envelope["user_id"],
                envelope.get("tenant_id"),
                envelope["stage_key"],
                envelope["stage_version"],
                envelope.get("profile_snapshot_hash"),
                envelope.get("job_identity_key"),
                envelope.get("job_source_url"),
                _json.dumps(envelope.get("job_provenance") or {}),
                envelope.get("artifact_hash"),
                envelope.get("artifact_version"),
                _json.dumps(envelope.get("artifact_provenance") or {}),
                envelope.get("approval_state", "not_required"),
                _json.dumps(envelope.get("failure_state")) if envelope.get("failure_state") is not None else None,
                envelope.get("input_hash"),
                envelope.get("output_hash"),
                envelope.get("observed_at"),
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("app.services.db: stage envelope persistence failed (%s)", exc)
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
                       completed_at, state_version, handoff_state,
                       handoff_expires_at, created_at, updated_at
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
        "completed_at, state_version, handoff_state, handoff_expires_at, "
        "created_at, updated_at FROM agent_runs "
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
                       completed_at, state_version, handoff_state,
                       handoff_expires_at, created_at, updated_at
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
    "transition_agent_run_for_user",
    "HITL_STATES",
]