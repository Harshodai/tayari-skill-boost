"""Durable checkpoint worker for the governed automation runtime.

This worker intentionally stops at a durable plan/action approval boundary. It
never executes an arbitrary tool from a database row, never sends a provider
message itself, and never reports an external side effect as successful without
a provider receipt and a separately governed executor.
"""
from __future__ import annotations

import hashlib
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Any

from app.celery_app import celery_app
from app.services.capabilities import Capability, capability_enabled

logger = logging.getLogger(__name__)


def action_hash(action_type: str, risk_tier: str, summary: str, payload: dict[str, Any], policy_version: str) -> str:
    canonical = "\x00".join(
        [
            action_type,
            risk_tier,
            summary,
            json.dumps(payload, sort_keys=True, separators=(",", ":")),
            policy_version,
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _record_event(conn: Any, run: Any, event_type: str, payload: dict[str, Any]) -> None:
    await conn.execute(
        """
        INSERT INTO automation_events (run_id, tenant_id, user_id, event_type, payload)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        """,
        run["id"],
        run["tenant_id"],
        run["user_id"],
        event_type,
        json.dumps(payload, separators=(",", ":")),
    )


async def _expire_runs(conn: Any) -> int:
    rows = await conn.fetch(
        """
        UPDATE automation_runs
        SET status='expired', completed_at=now(), updated_at=now(), version=version+1
        WHERE status IN ('queued','running','resumed','paused','awaiting_action_approval')
          AND expires_at IS NOT NULL AND expires_at <= now()
        RETURNING id, tenant_id, user_id
        """
    )
    for run in rows:
        await _record_event(conn, run, "automation.run.expired", {"reason": "run_expired"})
    return len(rows)


async def _claim_runs(conn: Any, limit: int = 50) -> list[Any]:
    return await conn.fetch(
        """
        WITH claimable AS (
            SELECT id
            FROM automation_runs
            WHERE status IN ('queued','resumed')
              AND (expires_at IS NULL OR expires_at > now())
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT $1
        )
        UPDATE automation_runs run
        SET status='running', started_at=COALESCE(started_at, now()), updated_at=now(), version=version+1
        FROM claimable
        WHERE run.id=claimable.id
        RETURNING run.id, run.definition_id, run.tenant_id, run.user_id, run.status, run.version
        """,
        limit,
    )


async def _create_plan_boundary(conn: Any, run: Any, definition: Any) -> None:
    policy_version = str(definition["policy_version"] or "v1")
    summary = "Review the automation plan before any tool or external action runs."
    payload = {
        "definition_id": str(definition["id"]),
        "trigger_type": definition["trigger_type"],
        "tool_allowlist": definition["tool_allowlist"] or [],
        "objective": definition["objective"],
    }
    action_type = "automation.plan_review"
    risk_tier = "draft"
    digest = action_hash(action_type, risk_tier, summary, payload, policy_version)
    raw_token = secrets.token_hex(32)
    await conn.execute(
        """
        INSERT INTO automation_steps
            (run_id, tenant_id, user_id, sequence_no, step_type, risk_tier, input_hash, payload, status, provenance)
        VALUES ($1, $2, $3, 0, 'plan_review', 'draft', $4, $5::jsonb, 'awaiting_approval', $6::jsonb)
        ON CONFLICT (run_id, sequence_no) DO NOTHING
        """,
        run["id"],
        run["tenant_id"],
        run["user_id"],
        digest,
        json.dumps(payload, separators=(",", ":")),
        json.dumps({"source": "automation_definition", "policy_version": policy_version}, separators=(",", ":")),
    )
    await conn.execute(
        """
        INSERT INTO approval_requests
            (run_id, tenant_id, user_id, action_type, risk_tier, action_hash, summary, payload,
             policy_version, review_token_digest, token_expires_at)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, now() + interval '15 minutes'
        WHERE NOT EXISTS (
            SELECT 1 FROM approval_requests
            WHERE run_id=$1 AND tenant_id=$2 AND user_id=$3 AND action_type=$4
              AND status IN ('pending','delivered','viewed','approved')
        )
        """,
        run["id"],
        run["tenant_id"],
        run["user_id"],
        action_type,
        risk_tier,
        digest,
        summary,
        json.dumps(payload, separators=(",", ":")),
        policy_version,
        token_digest(raw_token),
    )
    await conn.execute(
        """
        UPDATE automation_runs
        SET status='awaiting_action_approval', updated_at=now(), version=version+1
        WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='running'
        """,
        run["id"], run["tenant_id"], run["user_id"],
    )
    await _record_event(conn, run, "automation.plan.awaiting_approval", {"action_hash": digest})


async def _pause_unimplemented_tools(conn: Any, run: Any, definition: Any) -> None:
    await conn.execute(
        """
        UPDATE automation_runs
        SET status='paused', last_error='tool execution is not enabled for this release', updated_at=now(), version=version+1
        WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='running'
        """,
        run["id"], run["tenant_id"], run["user_id"],
    )
    await _record_event(
        conn,
        run,
        "automation.tool_execution.blocked",
        {
            "reason": "tool_runtime_not_enabled",
            "tool_allowlist": definition["tool_allowlist"] or [],
            "external_side_effect": False,
        },
    )


async def _dispatch() -> dict[str, Any]:
    if not capability_enabled(Capability.WORKSPACE_AUTOMATIONS):
        return {"status": "disabled_by_launch_scope", "expired": 0, "claimed": 0}
    from app.services.db import get_pool

    pool = await get_pool()
    if not pool:
        return {"status": "skipped_no_db", "expired": 0, "claimed": 0}
    async with pool.acquire() as conn:
        async with conn.transaction():
            expired = await _expire_runs(conn)
            claimed = await _claim_runs(conn)
            for run in claimed:
                definition = await conn.fetchrow(
                    """
                    SELECT id, objective, trigger_type, tool_allowlist, policy_version
                    FROM automation_definitions
                    WHERE id=$1 AND tenant_id=$2 AND user_id=$3
                    """,
                    run["definition_id"], run["tenant_id"], run["user_id"],
                )
                if not definition:
                    await conn.execute(
                        """
                        UPDATE automation_runs
                        SET status='failed', last_error='automation definition not found', updated_at=now(), version=version+1
                        WHERE id=$1 AND tenant_id=$2 AND user_id=$3
                        """,
                        run["id"], run["tenant_id"], run["user_id"],
                    )
                    await _record_event(conn, run, "automation.run.failed", {"reason": "definition_not_found"})
                    continue
                if definition["tool_allowlist"]:
                    await _pause_unimplemented_tools(conn, run, definition)
                else:
                    await _create_plan_boundary(conn, run, definition)
    return {"status": "ok", "expired": expired, "claimed": len(claimed)}


@celery_app.task(name="automation.dispatch_checkpoints", bind=True)
def dispatch_checkpoints(self) -> dict[str, Any]:
    """Claim and checkpoint durable automation runs; never bypass approval."""
    try:
        return __import__("asyncio").run(_dispatch())
    except Exception as exc:  # noqa: BLE001 - worker must report a truthful failure
        logger.exception("automation checkpoint dispatch failed")
        return {"status": "failed", "error": str(exc), "expired": 0, "claimed": 0}
