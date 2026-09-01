"""Database access layer for Digital Employees and Runtime Tool Approvals.

Uses the central asyncpg pool from app.services.db.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any
from app.services.db import get_pool

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Digital Employees CRUD
# ---------------------------------------------------------------------------

async def list_digital_employees(user_id: str) -> list[dict]:
    """Retrieve all digital employees for a given user."""
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT employee_id, user_id, name, role, remark_name, 
                       instructions, traits, active, runtime_id, created_at
                FROM digital_employees
                WHERE user_id = $1
                ORDER BY created_at ASC
                """,
                user_id
            )
            out = []
            for row in rows:
                item = dict(row)
                if isinstance(item.get("traits"), str):
                    item["traits"] = json.loads(item["traits"])
                out.append(item)
            return out
    except Exception as exc:
        logger.error("Failed to list digital employees: %s", exc)
        return []


async def get_digital_employee(user_id: str, name: str) -> dict | None:
    """Retrieve a single digital employee by user_id and name."""
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT employee_id, user_id, name, role, remark_name, 
                       instructions, traits, active, runtime_id, created_at
                FROM digital_employees
                WHERE user_id = $1 AND name = $2
                """,
                user_id, name
            )
            if not row:
                return None
            item = dict(row)
            if isinstance(item.get("traits"), str):
                item["traits"] = json.loads(item["traits"])
            return item
    except Exception as exc:
        logger.error("Failed to get digital employee: %s", exc)
        return None


async def create_or_update_digital_employee(
    user_id: str,
    name: str,
    role: str = "Agent",
    remark_name: str | None = None,
    instructions: str | None = None,
    traits: list[str] | None = None,
    active: bool = True,
    runtime_id: str | None = None,
) -> bool:
    """Insert or update a digital employee record."""
    pool = await get_pool()
    if not pool:
        return False
    traits_json = json.dumps(traits or [])
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO digital_employees 
                    (user_id, name, role, remark_name, instructions, traits, active, runtime_id)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
                ON CONFLICT (user_id, name) DO UPDATE SET
                    role = EXCLUDED.role,
                    remark_name = EXCLUDED.remark_name,
                    instructions = EXCLUDED.instructions,
                    traits = EXCLUDED.traits,
                    active = EXCLUDED.active,
                    runtime_id = EXCLUDED.runtime_id
                """,
                user_id, name, role, remark_name, instructions, traits_json, active, runtime_id
            )
        return True
    except Exception as exc:
        logger.error("Failed to upsert digital employee: %s", exc)
        return False


async def delete_digital_employee(user_id: str, name: str) -> bool:
    """Delete a digital employee record."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM digital_employees WHERE user_id = $1 AND name = $2",
                user_id, name
            )
        return True
    except Exception as exc:
        logger.error("Failed to delete digital employee: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Runtime Approvals CRUD
# ---------------------------------------------------------------------------

async def list_runtime_approvals(user_id: str) -> list[dict]:
    """List all tool approvals for a user, sorted by creation date descending."""
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT approval_id, user_id, task_id, agent_id, tool_name, 
                       tool_input, content_preview, status, reviewer_comment, 
                       reviewed_at, created_at
                FROM runtime_approvals
                WHERE user_id = $1
                ORDER BY created_at DESC
                """,
                user_id
            )
            out = []
            for row in rows:
                item = dict(row)
                if isinstance(item.get("tool_input"), str):
                    item["tool_input"] = json.loads(item["tool_input"])
                out.append(item)
            return out
    except Exception as exc:
        logger.error("Failed to list runtime approvals: %s", exc)
        return []


async def get_runtime_approval(user_id: str, approval_id: str) -> dict | None:
    """Fetch details of a single runtime approval."""
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT approval_id, user_id, task_id, agent_id, tool_name, 
                       tool_input, content_preview, status, reviewer_comment, 
                       reviewed_at, created_at
                FROM runtime_approvals
                WHERE user_id = $1 AND approval_id = $2
                """,
                user_id, approval_id
            )
            if not row:
                return None
            item = dict(row)
            if isinstance(item.get("tool_input"), str):
                item["tool_input"] = json.loads(item["tool_input"])
            return item
    except Exception as exc:
        logger.error("Failed to get runtime approval: %s", exc)
        return None


async def create_runtime_approval(
    user_id: str,
    task_id: str | None,
    agent_id: str,
    tool_name: str,
    tool_input: dict,
    content_preview: str,
) -> str | None:
    """Insert a new runtime tool approval in pending status. Returns approval_id."""
    pool = await get_pool()
    if not pool:
        return None
    tool_input_json = json.dumps(tool_input)
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO runtime_approvals
                    (user_id, task_id, agent_id, tool_name, tool_input, content_preview, status)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'pending')
                RETURNING approval_id
                """,
                user_id, task_id, agent_id, tool_name, tool_input_json, content_preview
            )
            if row:
                return str(row["approval_id"])
            return None
    except Exception as exc:
        logger.error("Failed to create runtime approval: %s", exc)
        return None


async def update_runtime_approval(
    user_id: str,
    approval_id: str,
    status: str,
    reviewer_comment: str | None = None,
) -> bool:
    """Approve or reject a pending approval using an atomic compare-and-set transition."""
    if status not in ("approved", "rejected", "pending"):
        raise ValueError(f"Invalid status: {status}")
    pool = await get_pool()
    if not pool:
        # No durable write occurred; signal failure so callers do not report
        # approval success or remove the pending cache entry prematurely.
        return False

    try:
        async with pool.acquire() as conn:
            res = await conn.execute(
                """
                UPDATE runtime_approvals
                SET status = $3,
                    reviewer_comment = $4,
                    reviewed_at = now()
                WHERE user_id = $1
                  AND (approval_id::text = $2 OR tool_input->>'approval_id' = $2)
                  AND status = 'pending'
                """,
                user_id, approval_id, status, reviewer_comment
            )
            try:
                affected = int(res.split()[-1])
                return affected == 1
            except (ValueError, IndexError):
                return res.endswith("1")
    except Exception as exc:
        logger.error("Failed to update runtime approval: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Agent Tasks, Attempts, and Events CRUD (AgentSpace In-Depth)
# ---------------------------------------------------------------------------

async def create_agent_task(
    user_id: str,
    agent_id: str,
    title: str,
    input_json: dict | None = None,
) -> str | None:
    """Create a new agent task, returning its task_id."""
    pool = await get_pool()
    if not pool:
        return None
    input_str = json.dumps(input_json or {})
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO agent_tasks (user_id, agent_id, title, status, input_json)
                VALUES ($1, $2, $3, 'queued', $4::jsonb)
                RETURNING task_id
                """,
                user_id, agent_id, title, input_str
            )
            if row:
                return str(row["task_id"])
            return None
    except Exception as exc:
        logger.error("Failed to create agent task: %s", exc)
        return None


async def get_agent_task(user_id: str, task_id: str) -> dict | None:
    """Fetch details of a single agent task."""
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT task_id, user_id, agent_id, title, status, 
                       input_json, result_json, error_text, created_at, updated_at
                FROM agent_tasks
                WHERE user_id = $1 AND task_id = $2
                """,
                user_id, task_id
            )
            if not row:
                return None
            item = dict(row)
            if isinstance(item.get("input_json"), str):
                item["input_json"] = json.loads(item["input_json"])
            if isinstance(item.get("result_json"), str):
                item["result_json"] = json.loads(item["result_json"])
            return item
    except Exception as exc:
        logger.error("Failed to get agent task: %s", exc)
        return None


async def list_agent_tasks(user_id: str, agent_id: str | None = None) -> list[dict]:
    """List agent tasks, optionally filtered by agent_id."""
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            if agent_id:
                rows = await conn.fetch(
                    """
                    SELECT task_id, user_id, agent_id, title, status, 
                           input_json, result_json, error_text, created_at, updated_at
                    FROM agent_tasks
                    WHERE user_id = $1 AND agent_id = $2
                    ORDER BY created_at DESC
                    """,
                    user_id, agent_id
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT task_id, user_id, agent_id, title, status, 
                           input_json, result_json, error_text, created_at, updated_at
                    FROM agent_tasks
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    """,
                    user_id
                )
            out = []
            for row in rows:
                item = dict(row)
                if isinstance(item.get("input_json"), str):
                    item["input_json"] = json.loads(item["input_json"])
                if isinstance(item.get("result_json"), str):
                    item["result_json"] = json.loads(item["result_json"])
                out.append(item)
            return out
    except Exception as exc:
        logger.error("Failed to list agent tasks: %s", exc)
        return []


async def update_agent_task_status(
    user_id: str,
    task_id: str,
    status: str,
    result_json: dict | None = None,
    error_text: str | None = None,
) -> bool:
    """Update task status, results, and error message."""
    pool = await get_pool()
    if not pool:
        return False
    result_str = json.dumps(result_json or {})
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE agent_tasks
                SET status = $3,
                    result_json = $4::jsonb,
                    error_text = $5,
                    updated_at = now()
                WHERE user_id = $1 AND task_id = $2
                """,
                user_id, task_id, status, result_str, error_text
            )
        return True
    except Exception as exc:
        logger.error("Failed to update agent task status: %s", exc)
        return False


def _swarm_digest(value: Any) -> str:
    serialized = json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


async def create_agent_task_child(
    user_id: str,
    task_id: str,
    step_id: str,
    role: str,
    input_value: Any,
    attempt_number: int = 1,
) -> str | None:
    """Persist a bounded child identity and input digest, never raw child input."""
    if not user_id or not task_id or not step_id or not role or attempt_number < 1:
        return None
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO agent_task_children
                    (user_id, task_id, step_id, role, attempt_number, status, input_digest, started_at)
                VALUES ($1, $2, $3, $4, $5, 'running', $6, NOW())
                ON CONFLICT (task_id, step_id, attempt_number) DO UPDATE SET
                    status = 'running',
                    input_digest = EXCLUDED.input_digest,
                    started_at = NOW(),
                    finished_at = NULL,
                    error_text = NULL,
                    updated_at = NOW()
                RETURNING child_id
                """,
                user_id, task_id, step_id, role, attempt_number, _swarm_digest(input_value),
            )
        return str(row["child_id"]) if row else None
    except Exception as exc:
        logger.warning("Failed to create agent task child: %s", exc)
        return None


async def update_agent_task_child(
    user_id: str,
    child_id: str,
    status: str,
    output_value: Any = None,
    error_text: str | None = None,
) -> bool:
    """Update child lifecycle with a digest only; raw specialist output is discarded."""
    if status not in {"queued", "running", "completed", "failed", "timed_out", "cancelled"}:
        return False
    pool = await get_pool()
    if not pool:
        return False
    output_digest = _swarm_digest(output_value) if output_value is not None else None
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE agent_task_children
                SET status = $3,
                    output_digest = $4,
                    error_text = LEFT($5, 240),
                    finished_at = CASE WHEN $3 IN ('completed', 'failed', 'timed_out', 'cancelled') THEN NOW() ELSE finished_at END,
                    updated_at = NOW()
                WHERE child_id = $1 AND user_id = $2
                """,
                child_id, user_id, status, output_digest, error_text,
            )
        return result.endswith("1")
    except Exception as exc:
        logger.warning("Failed to update agent task child: %s", exc)
        return False


async def create_agent_task_attempt(
    user_id: str,
    task_id: str,
    attempt_number: int = 1,
    status: str = "running",
) -> str | None:
    """Record the start of a task execution attempt."""
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO agent_task_attempts (user_id, task_id, attempt_number, status)
                VALUES ($1, $2, $3, $4)
                RETURNING attempt_id
                """,
                user_id, task_id, attempt_number, status
            )
            if row:
                return str(row["attempt_id"])
            return None
    except Exception as exc:
        logger.error("Failed to create agent task attempt: %s", exc)
        return None


async def update_agent_task_attempt(
    user_id: str,
    attempt_id: str,
    status: str,
    error_text: str | None = None,
) -> bool:
    """Record completion or failure of a task attempt."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE agent_task_attempts
                SET status = $3,
                    error_text = $4,
                    finished_at = now()
                WHERE user_id = $1 AND attempt_id = $2
                """,
                user_id, attempt_id, status, error_text
            )
        return True
    except Exception as exc:
        logger.error("Failed to update agent task attempt: %s", exc)
        return False


async def create_agent_router_event(
    user_id: str,
    task_id: str,
    event_type: str,
    summary: str,
    payload_json: dict | None = None,
) -> bool:
    """Log an execution step event."""
    pool = await get_pool()
    if not pool:
        return False
    payload_str = json.dumps(payload_json or {})
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO agent_router_events (user_id, task_id, type, summary, payload_json)
                VALUES ($1, $2, $3, $4, $5::jsonb)
                """,
                user_id, task_id, event_type, summary, payload_str
            )
        return True
    except Exception as exc:
        logger.error("Failed to create agent router event: %s", exc)
        return False


async def list_agent_router_events(user_id: str, task_id: str) -> list[dict]:
    """Retrieve chronological event steps for a given task."""
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT event_id, user_id, task_id, type, summary, payload_json, created_at
                FROM agent_router_events
                WHERE user_id = $1 AND task_id = $2
                ORDER BY created_at ASC
                """,
                user_id, task_id
            )
            out = []
            for row in rows:
                item = dict(row)
                if isinstance(item.get("payload_json"), str):
                    item["payload_json"] = json.loads(item["payload_json"])
                out.append(item)
            return out
    except Exception as exc:
        logger.error("Failed to list agent router events: %s", exc)
        return []
