"""Durable persistence helpers for asynchronous external-provider research runs."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from app.services.db import get_pool

logger = logging.getLogger(__name__)

_TERMINAL = {"succeeded", "failed", "aborted", "timed_out", "cancelled", "expired"}
_ALLOWED_UPDATE_FIELDS = {
    "status", "progress", "provider_run_id", "dataset_id", "result", "result_count",
    "truncated", "error_code", "error_message", "celery_task_id", "lease_owner",
    "lease_expires_at", "last_heartbeat_at", "retry_count", "started_at", "completed_at",
}


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    return dict(row) if row else None


async def create_external_research_run(
    *,
    user_id: str,
    subject: str,
    request_id: str | None,
    idempotency_key: str,
    query: str,
    requested_limit: int,
    actor_id: str,
    deadline_at: datetime,
) -> dict[str, Any] | None:
    if not user_id or not idempotency_key:
        return None
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO public.external_research_runs
                    (user_id, subject, request_id, idempotency_key, provider,
                     query, requested_limit, actor_id, deadline_at)
                VALUES ($1, $2, $3, $4, 'apify', $5, $6, $7, $8)
                ON CONFLICT (user_id, idempotency_key)
                DO UPDATE SET updated_at = now()
                RETURNING *
                """,
                user_id, subject, request_id, idempotency_key, query,
                requested_limit, actor_id, deadline_at,
            )
        return _row_to_dict(row)
    except Exception as exc:  # noqa: BLE001
        logger.warning("external research run creation failed: %s", exc)
        return None


async def attach_external_research_task(job_id: str, task_id: str) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE public.external_research_runs SET celery_task_id=$2, updated_at=now() WHERE job_id=$1",
                job_id, task_id,
            )
        return result.endswith("1")
    except Exception as exc:  # noqa: BLE001
        logger.warning("external research task attachment failed: %s", exc)
        return False


async def load_external_research_run_for_user(job_id: str, user_id: str) -> dict[str, Any] | None:
    if not job_id or not user_id:
        return None
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM public.external_research_runs WHERE job_id=$1 AND user_id=$2",
                job_id, user_id,
            )
        return _row_to_dict(row)
    except Exception as exc:  # noqa: BLE001
        logger.warning("external research owner lookup failed: %s", exc)
        return None


async def claim_external_research_run(job_id: str, lease_owner: str, lease_seconds: int = 180) -> dict[str, Any] | None:
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.external_research_runs
                   SET status='running', lease_owner=$2,
                       lease_expires_at=now() + make_interval(secs => $3),
                       last_heartbeat_at=now(), started_at=COALESCE(started_at, now()),
                       updated_at=now()
                 WHERE job_id=$1
                   AND status IN ('accepted','running')
                   AND (lease_expires_at IS NULL OR lease_expires_at < now())
                   AND deadline_at > now()
                RETURNING *
                """,
                job_id, lease_owner, lease_seconds,
            )
        return _row_to_dict(row)
    except Exception as exc:  # noqa: BLE001
        logger.warning("external research claim failed: %s", exc)
        return None


async def heartbeat_external_research_run(job_id: str, lease_owner: str, lease_seconds: int = 180) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE public.external_research_runs
                   SET last_heartbeat_at=now(), lease_expires_at=now() + make_interval(secs => $3),
                       updated_at=now()
                 WHERE job_id=$1 AND lease_owner=$2 AND status='running'
                """,
                job_id, lease_owner, lease_seconds,
            )
        return result.endswith("1")
    except Exception as exc:  # noqa: BLE001
        logger.warning("external research heartbeat failed: %s", exc)
        return False


async def update_external_research_run(job_id: str, **fields: Any) -> bool:
    fields = {key: value for key, value in fields.items() if key in _ALLOWED_UPDATE_FIELDS}
    if not fields:
        return False
    pool = await get_pool()
    if not pool:
        return False
    sets: list[str] = []
    args: list[Any] = [job_id]
    for index, (key, value) in enumerate(fields.items(), start=2):
        if key == "result":
            sets.append(f"{key}=${index}::jsonb")
            args.append(json.dumps(value))
        else:
            sets.append(f"{key}=${index}")
            args.append(value)
    sets.append("updated_at=now()")
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"UPDATE public.external_research_runs SET {', '.join(sets)} WHERE job_id=$1",  # noqa: S608
                *args,
            )
        return result.endswith("1")
    except Exception as exc:  # noqa: BLE001
        logger.warning("external research update failed: %s", exc)
        return False


async def cancel_external_research_run(job_id: str, user_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE public.external_research_runs
                   SET status='cancelled', completed_at=now(), updated_at=now()
                 WHERE job_id=$1 AND user_id=$2 AND status NOT IN ('succeeded','failed','aborted','timed_out','cancelled','expired')
                RETURNING *
                """,
                job_id, user_id,
            )
        return _row_to_dict(row)
    except Exception as exc:  # noqa: BLE001
        logger.warning("external research cancellation failed: %s", exc)
        return None


__all__ = [
    "attach_external_research_task",
    "cancel_external_research_run",
    "claim_external_research_run",
    "create_external_research_run",
    "heartbeat_external_research_run",
    "load_external_research_run_for_user",
    "update_external_research_run",
]
