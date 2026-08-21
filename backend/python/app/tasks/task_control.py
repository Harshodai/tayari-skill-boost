"""Durable execution for the candidate-controlled Tay Workspace.

This worker is intentionally draft-only. It consumes an owner-approved task
plan, creates durable lifecycle events, and asks the configured LLM to produce
a reviewable result from the user's objective and approved plan. It never
opens a browser, sends a message, submits an application, or claims an
external side effect.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.celery_app import celery_app
from app.services.db import get_pool
from app.services.llm_service import LLMNotConfiguredError, llm_complete

logger = logging.getLogger(__name__)

CLAIM_LIMIT = 10


def build_draft_prompt(title: str, objective: str, steps: list[Any]) -> tuple[str, str]:
    """Build a bounded prompt that cannot authorize external actions."""
    system = (
        "You are Tay, a candidate-controlled career operations assistant. "
        "Produce a reviewable draft result only. Never claim that you browsed, "
        "sent, submitted, booked, purchased, contacted, or changed anything. "
        "Never invent candidate facts, provider data, receipts, URLs, scores, "
        "or completion evidence. If the objective requests an external action, "
        "explain the safest human-reviewed next step instead. Use only the "
        "user objective and the approved plan below."
    )
    plan_text = json.dumps(steps, ensure_ascii=False, sort_keys=True)
    user = (
        f"Task title: {title}\n"
        f"User objective: {objective}\n"
        f"Approved plan: {plan_text}\n\n"
        "Return a concise Markdown draft with these headings: Result, "
        "Evidence and assumptions, Human review required, and Next safe step."
    )
    return system, user


async def _record_event(conn: Any, task_id: str, user_id: str, event_type: str, payload: dict[str, Any]) -> None:
    await conn.execute(
        """
        INSERT INTO task_events (task_id, user_id, event_type, payload)
        VALUES ($1, $2, $3, $4::jsonb)
        """,
        task_id,
        user_id,
        event_type,
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
    )


async def _claim_tasks(pool: Any) -> list[Any]:
    async with pool.acquire() as conn:
        async with conn.transaction():
            return list(await conn.fetch(
                """
                WITH claimable AS (
                    SELECT id
                    FROM task_runs
                    WHERE status='queued'
                    ORDER BY updated_at, created_at
                    FOR UPDATE SKIP LOCKED
                    LIMIT $1
                )
                UPDATE task_runs run
                SET status='running', version=version+1, updated_at=now()
                FROM claimable
                WHERE run.id=claimable.id AND run.status='queued'
                RETURNING run.id, run.user_id, run.title, run.objective
                """,
                CLAIM_LIMIT,
            ))


async def _load_approved_plan(conn: Any, task_id: str, user_id: str) -> list[Any] | None:
    row = await conn.fetchrow(
        """
        SELECT steps
        FROM task_plans
        WHERE task_id=$1 AND user_id=$2 AND status='approved'
        ORDER BY version DESC
        LIMIT 1
        """,
        task_id,
        user_id,
    )
    if not row:
        return None
    steps = row["steps"]
    if isinstance(steps, str):
        steps = json.loads(steps)
    return steps if isinstance(steps, list) else []


async def _mark_failed(pool: Any, task: Any, code: str, message: str) -> None:
    async with pool.acquire() as conn:
        async with conn.transaction():
            changed = await conn.fetchval(
                """
                UPDATE task_runs
                SET status='failed', version=version+1, updated_at=now()
                WHERE id=$1 AND user_id=$2 AND status='running'
                RETURNING id
                """,
                task["id"],
                task["user_id"],
            )
            if changed:
                await _record_event(conn, str(task["id"]), str(task["user_id"]), "task.failed", {
                    "error_code": code,
                    "message": message,
                    "external_side_effect": False,
                })


async def _execute_one(pool: Any, task: Any) -> dict[str, Any]:
    task_id = str(task["id"])
    user_id = str(task["user_id"])
    async with pool.acquire() as conn:
        steps = await _load_approved_plan(conn, task_id, user_id)
        if steps is None:
            await conn.execute(
                "UPDATE task_runs SET status='failed', version=version+1, updated_at=now() WHERE id=$1 AND user_id=$2 AND status='running'",
                task["id"], task["user_id"],
            )
            await _record_event(conn, task_id, user_id, "task.failed", {
                "error_code": "approved_plan_missing",
                "message": "No approved plan was available for this task.",
                "external_side_effect": False,
            })
            return {"task_id": task_id, "status": "failed", "error_code": "approved_plan_missing"}
        await _record_event(conn, task_id, user_id, "task.execution.started", {
            "executor": "draft_only_task_control",
            "step_count": len(steps),
            "external_side_effect": False,
        })

    system, prompt = build_draft_prompt(str(task["title"]), str(task["objective"]), steps)
    try:
        draft = await llm_complete(system, prompt, tier="fast", max_tokens=1600, temperature=0.2)
    except LLMNotConfiguredError:
        await _mark_failed(pool, task, "ai_service_unavailable", "No configured AI provider is available for this task.")
        return {"task_id": task_id, "status": "failed", "error_code": "ai_service_unavailable"}
    except Exception as exc:  # noqa: BLE001 - persist truthful failure
        logger.exception("Tay task %s draft execution failed", task_id)
        await _mark_failed(pool, task, "task_execution_failed", "The draft executor failed before producing a result.")
        return {"task_id": task_id, "status": "failed", "error_code": "task_execution_failed", "detail": str(exc)}

    async with pool.acquire() as conn:
        async with conn.transaction():
            changed = await conn.fetchval(
                """
                UPDATE task_runs
                SET status='completed', version=version+1, updated_at=now()
                WHERE id=$1 AND user_id=$2 AND status='running'
                RETURNING id
                """,
                task["id"],
                task["user_id"],
            )
            if not changed:
                await _record_event(conn, task_id, user_id, "task.execution.interrupted", {
                    "message": "Task state changed before the draft could be committed.",
                    "external_side_effect": False,
                })
                return {"task_id": task_id, "status": "interrupted"}
            await _record_event(conn, task_id, user_id, "task.completed", {
                "result_markdown": str(draft),
                "executor": "draft_only_task_control",
                "requires_human_review": True,
                "external_side_effect": False,
                "provenance": {"source": "configured_llm", "task_id": task_id},
            })
    return {"task_id": task_id, "status": "completed"}


async def _dispatch() -> dict[str, Any]:
    pool = await get_pool()
    if not pool:
        return {"status": "skipped_no_db", "claimed": 0, "completed": 0, "failed": 0}
    tasks = await _claim_tasks(pool)
    completed = 0
    failed = 0
    for task in tasks:
        result = await _execute_one(pool, task)
        if result.get("status") == "completed":
            completed += 1
        elif result.get("status") == "failed":
            failed += 1
    return {"status": "ok", "claimed": len(tasks), "completed": completed, "failed": failed}


@celery_app.task(name="task_control.dispatch_checkpoints", bind=True)
def dispatch_checkpoints(self) -> dict[str, Any]:
    """Claim approved Tay tasks and produce reviewable draft results."""
    try:
        return asyncio.run(_dispatch())
    except Exception as exc:  # noqa: BLE001 - worker must report a truthful failure
        logger.exception("Tay task-control dispatch failed")
        return {"status": "failed", "claimed": 0, "completed": 0, "failed": 0, "error": str(exc)}
