"""Durable control-plane primitives for candidate-owned automation runs.

The browser and worker layers use this module in addition to their in-process
fast paths.  PostgreSQL is the source of truth when it is configured: a stop
request survives worker replacement, an acknowledgement is observable, and a
worker lease cannot be reused by another candidate.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services.db import get_pool

logger = logging.getLogger(__name__)
DEFAULT_LEASE_SECONDS = 120


class RunControlOwnershipError(PermissionError):
    """Raised when a control snapshot is requested by a non-owner."""


class RunControlStoreUnavailable(RuntimeError):
    """Raised when durable state cannot be read safely."""


async def emit_run_event(
    run_id: str,
    user_id: str,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    """Append an immutable candidate-scoped run event when durable storage exists."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO run_events (run_id, user_id, event_type, payload)
                SELECT run_id, user_id, $3, $4::jsonb
                FROM agent_runs
                WHERE run_id = $1 AND user_id = $2
                """,
                run_id,
                user_id,
                event_type,
                json.dumps(payload or {}),
            )
        return True
    except Exception as exc:  # noqa: BLE001 - execution can continue with local controls
        logger.warning("run control: failed to emit event for %s (%s)", run_id, exc)
        return False


async def request_cancellation(run_id: str, user_id: str, reason: str = "candidate_requested") -> bool:
    """Persist cancellation intent only when the caller owns the run.

    The operation is idempotent.  It returns ``False`` for a missing/foreign
    run or unavailable durable store; callers can then fall back to a live
    in-process session only for already-authenticated requests.
    """
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            changed = await conn.fetchval(
                """
                WITH owned_run AS (
                    SELECT run_id, user_id
                    FROM agent_runs
                    WHERE run_id = $1 AND user_id = $2
                ), upsert AS (
                    INSERT INTO run_controls (run_id, user_id, cancellation_requested_at, cancellation_reason)
                    SELECT run_id, user_id, now(), $3 FROM owned_run
                    ON CONFLICT (run_id) DO UPDATE
                    SET cancellation_requested_at = COALESCE(run_controls.cancellation_requested_at, now()),
                        cancellation_reason = COALESCE(run_controls.cancellation_reason, EXCLUDED.cancellation_reason),
                        updated_at = now()
                    RETURNING run_id
                )
                SELECT run_id FROM upsert
                """,
                run_id,
                user_id,
                reason[:500],
            )
        if changed:
            await emit_run_event(run_id, user_id, "cancellation_requested", {"reason": reason[:500]})
        return bool(changed)
    except Exception as exc:  # noqa: BLE001
        logger.warning("run control: cancellation request failed for %s (%s)", run_id, exc)
        return False


async def cancellation_requested(run_id: str, user_id: str | None = None) -> bool:
    """Return durable cancellation intent, optionally verifying candidate ownership."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            if user_id:
                value = await conn.fetchval(
                    """
                    SELECT rc.cancellation_requested_at IS NOT NULL
                    FROM run_controls rc
                    JOIN agent_runs ar ON ar.run_id = rc.run_id
                    WHERE rc.run_id = $1 AND ar.user_id = $2
                    """,
                    run_id,
                    user_id,
                )
            else:
                value = await conn.fetchval(
                    "SELECT cancellation_requested_at IS NOT NULL FROM run_controls WHERE run_id = $1",
                    run_id,
                )
        return bool(value)
    except Exception as exc:  # noqa: BLE001
        logger.warning("run control: cancellation lookup failed for %s (%s)", run_id, exc)
        return False


async def acknowledge_cancellation(run_id: str, user_id: str, outcome: str) -> bool:
    """Persist that a worker saw and acted on a candidate's stop request."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            changed = await conn.fetchval(
                """
                UPDATE run_controls rc
                SET cancellation_acknowledged_at = now(), updated_at = now()
                FROM agent_runs ar
                WHERE rc.run_id = $1
                  AND ar.run_id = rc.run_id
                  AND ar.user_id = $2
                  AND rc.cancellation_requested_at IS NOT NULL
                RETURNING rc.run_id
                """,
                run_id,
                user_id,
            )
            if changed:
                await conn.execute(
                    """
                    UPDATE agent_runs
                    SET status = 'cancelled', completed_at = now(), current_step = 'cancelled', updated_at = now()
                    WHERE run_id = $1 AND user_id = $2 AND status NOT IN ('completed', 'failed', 'cancelled')
                    """,
                    run_id,
                    user_id,
                )
        if changed:
            await emit_run_event(run_id, user_id, "cancellation_acknowledged", {"outcome": outcome[:500]})
        return bool(changed)
    except Exception as exc:  # noqa: BLE001
        logger.warning("run control: cancellation acknowledgement failed for %s (%s)", run_id, exc)
        return False


async def get_run_control_snapshot(
    run_id: str,
    user_id: str,
    event_limit: int = 100,
) -> dict[str, Any] | None:
    """Return candidate-owned run state and an immutable bounded event history.

    ``None`` deliberately conflates a missing/foreign run and an unavailable
    durable store.  API callers must fail closed rather than disclose whether
    another candidate owns an identifier or reconstruct state from memory.
    """
    pool = await get_pool()
    if not pool:
        raise RunControlStoreUnavailable("durable run-control storage is unavailable")
    event_limit = max(1, min(int(event_limit), 200))
    try:
        async with pool.acquire() as conn:
            run = await conn.fetchrow(
                """
                SELECT ar.run_id, ar.user_id, ar.run_type, ar.status, ar.progress, ar.current_step,
                       ar.created_at, ar.started_at, ar.completed_at,
                       rc.cancellation_requested_at IS NOT NULL AS cancellation_requested,
                       rc.cancellation_requested_at, rc.cancellation_reason,
                       rc.cancellation_acknowledged_at IS NOT NULL AS cancellation_acknowledged,
                       rc.cancellation_acknowledged_at, rc.worker_lease_expires_at,
                       COALESCE(rc.worker_lease_expires_at > NOW(), FALSE) AS lease_active
                FROM agent_runs ar
                LEFT JOIN run_controls rc ON rc.run_id = ar.run_id AND rc.user_id = ar.user_id
                WHERE ar.run_id = $1
                """,
                run_id,
            )
            if not run:
                return None
            if str(run["user_id"]) != user_id:
                raise RunControlOwnershipError("run belongs to a different candidate")
            events = await conn.fetch(
                """
                SELECT sequence_no, event_type, payload, created_at
                FROM run_events
                WHERE run_id = $1 AND user_id = $2
                ORDER BY sequence_no DESC
                LIMIT $3
                """,
                run_id,
                user_id,
                event_limit,
            )
        snapshot = dict(run)
        snapshot.pop("user_id", None)
        snapshot["events"] = [dict(event) for event in reversed(events)]
        return snapshot
    except RunControlOwnershipError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("run control: snapshot lookup failed for %s (%s)", run_id, exc)
        raise RunControlStoreUnavailable("durable run-control storage is unavailable") from exc


async def acquire_worker_lease(
    run_id: str,
    user_id: str,
    worker_id: str | None = None,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
) -> str | None:
    """Acquire a short candidate-bound lease, returning an opaque token.

    A second worker cannot steal a non-expired lease.  This is a guardrail for
    at-least-once delivery; handlers remain responsible for idempotent actions.
    """
    pool = await get_pool()
    if not pool:
        return None
    worker_id = (worker_id or os.getenv("HOSTNAME") or "unknown-worker")[:200]
    lease_seconds = max(30, min(int(lease_seconds), 900))
    token = str(uuid.uuid4())
    try:
        async with pool.acquire() as conn:
            acquired = await conn.fetchval(
                """
                WITH owned_run AS (
                    SELECT run_id, user_id FROM agent_runs WHERE run_id = $1 AND user_id = $2
                )
                INSERT INTO run_controls (run_id, user_id, worker_id, worker_lease_token, worker_lease_expires_at)
                SELECT run_id, user_id, $3, $4::uuid, now() + ($5 * interval '1 second')
                FROM owned_run
                ON CONFLICT (run_id) DO UPDATE
                SET worker_id = EXCLUDED.worker_id,
                    worker_lease_token = EXCLUDED.worker_lease_token,
                    worker_lease_expires_at = EXCLUDED.worker_lease_expires_at,
                    updated_at = now()
                WHERE run_controls.worker_lease_expires_at IS NULL
                   OR run_controls.worker_lease_expires_at <= now()
                   OR run_controls.worker_id = EXCLUDED.worker_id
                RETURNING worker_lease_token
                """,
                run_id,
                user_id,
                worker_id,
                token,
                lease_seconds,
            )
        if acquired:
            await emit_run_event(run_id, user_id, "worker_lease_acquired", {"worker_id": worker_id})
        return str(acquired) if acquired else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("run control: lease acquire failed for %s (%s)", run_id, exc)
        return None


async def release_worker_lease(run_id: str, user_id: str, token: str | None) -> bool:
    """Release only the exact lease token issued to this candidate's worker."""
    if not token:
        return False
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            changed = await conn.fetchval(
                """
                UPDATE run_controls
                SET worker_lease_token = NULL, worker_lease_expires_at = now(), updated_at = now()
                WHERE run_id = $1 AND user_id = $2 AND worker_lease_token = $3::uuid
                RETURNING run_id
                """,
                run_id,
                user_id,
                token,
            )
        return bool(changed)
    except Exception as exc:  # noqa: BLE001
        logger.warning("run control: lease release failed for %s (%s)", run_id, exc)
        return False


__all__ = [
    "RunControlOwnershipError",
    "RunControlStoreUnavailable",
    "acknowledge_cancellation",
    "acquire_worker_lease",
    "cancellation_requested",
    "emit_run_event",
    "get_run_control_snapshot",
    "release_worker_lease",
    "request_cancellation",
]
