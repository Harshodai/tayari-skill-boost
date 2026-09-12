"""Saga Pattern for Browser Automation and Distributed Workflows (Tier 2 — D2).

Provides linear saga execution with compensating transactions. If any step fails,
previously completed steps are compensated in reverse order to ensure consistent
state and clean rollback.

Durability (2026-09-12): step definitions themselves (the execute/compensate
closures) are still in-memory only — they close over live resources like a
Playwright ``Page`` tied to a real CDP connection, which cannot be serialized
or reconstructed in another process. What IS now durable is the *journal*:
a Postgres row tracking which steps started, completed, failed, or were
compensated, upserted after every transition. This means:

  - A worker crash mid-saga leaves a durable record instead of the run
    silently vanishing with no trace anywhere.
  - ``recover_orphaned_sagas()`` (called on worker startup and by a periodic
    Celery beat task, see app/tasks/automation.py) finds journal rows stuck
    in "running" past a staleness window and marks them "orphaned" so
    whatever surfaces run status to a user reports failure instead of an
    infinite spinner.

What this deliberately does NOT do: resume a saga mid-flight, or replay
compensation, after a crash. For this saga's real steps (navigate/fill/review
against a live browser page), both are impossible in principle, not just
unimplemented — the worker process that crashed is what was running the
browser too, so the page, tab, and any partially-filled form are already
gone. There is nothing left to resume against and nothing left to clean up;
the correct recovery is "mark it failed, let the caller retry the whole flow
with a fresh browser session," which is exactly what the orphan sweep does.
A saga whose steps operate on durable, externally-addressable resources
(a payment, a database row) could genuinely resume or reverse-compensate
after a crash — this module's journal makes that possible for such sagas by
persisting a per-step ``resumable`` flag, but nothing in this codebase uses
that path yet.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)

# How long a saga can sit in "running" with no journal update before the
# orphan sweep treats it as abandoned (worker crash/restart, not just a slow
# step). Generous relative to a normal browser-automation step (seconds to
# low tens of seconds) so a genuinely slow-but-alive step is never
# misdiagnosed as orphaned.
ORPHAN_STALENESS = timedelta(minutes=10)


class StepStatus(str, Enum):
    """Execution status for an individual saga step."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATED = "compensated"


class SagaStatus(str, Enum):
    """Overall status for a saga journal row."""

    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ORPHANED = "orphaned"


@dataclass
class SagaStep:
    """A single step in a saga, with forward execution and optional backward compensation."""

    name: str
    execute: Callable[..., Coroutine[Any, Any, Any]]
    compensate: Callable[..., Coroutine[Any, Any, Any]] | None = None
    status: StepStatus = StepStatus.PENDING
    result: Any = None
    error: str | None = None
    # True only for steps whose execute/compensate act on a durable,
    # externally-addressable resource (safe to retry/replay after a crash
    # from a different process). False (the default) for steps tied to an
    # in-process, non-recoverable resource like a live browser page — the
    # orphan sweep never attempts to resume or replay these regardless of
    # journal contents, so mislabeling a step True here can't cause a replay
    # against a resource that's actually gone; it only affects what future
    # resumable-saga code paths (none exist yet) would be allowed to do.
    resumable: bool = False


def _safe_json(value: Any) -> Any:
    """Best-effort JSON-safe snapshot of a step result for the journal.

    Step results in this codebase are plain dicts (see
    browser_worker_pool.py's steps), but this module is a generic saga
    utility, not specific to browser automation — a future caller's result
    could be anything. Never let an unserializable result break the journal
    write for every other step; fall back to a truncated repr.
    """
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return {"__unserializable__": True, "repr": repr(value)[:500]}


def _step_snapshot(step: SagaStep) -> dict:
    return {
        "name": step.name,
        "status": step.status.value,
        "resumable": step.resumable,
        "error": step.error,
        "result": _safe_json(step.result) if step.status == StepStatus.COMPLETED else None,
    }


async def _get_pool_safe():
    try:
        from app.services.db import get_pool

        return await get_pool()
    except Exception as exc:  # noqa: BLE001 - journal must never break the saga
        logger.warning("saga journal: DB pool unavailable: %s", exc)
        return None


async def _journal_upsert(
    task_id: str,
    user_id: str,
    saga_name: str,
    status: SagaStatus,
    steps: list[dict],
    error: str | None = None,
) -> None:
    """Best-effort UPSERT of the saga's current full state.

    Guarded like every other DB write in this codebase (automation_engine.py,
    tasks/automation.py): a DB hiccup here must never abort or slow down the
    actual saga execution, so every failure is caught and logged, never
    raised. The whole `steps` array is re-written on every call rather than
    patched in place — simpler and safer than granular JSONB patches, and
    cheap at this scale (a handful of steps, a handful of writes per saga).
    """
    pool = await _get_pool_safe()
    if not pool:
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO saga_journal (task_id, user_id, saga_name, status, steps, error, updated_at, completed_at)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, now(),
                        CASE WHEN $4 IN ('completed', 'failed') THEN now() ELSE NULL END)
                ON CONFLICT (task_id, saga_name) DO UPDATE
                SET status = EXCLUDED.status,
                    steps = EXCLUDED.steps,
                    error = EXCLUDED.error,
                    updated_at = now(),
                    completed_at = CASE WHEN EXCLUDED.status IN ('completed', 'failed')
                                        THEN now() ELSE saga_journal.completed_at END
                """,
                task_id, user_id, saga_name, status.value, json.dumps(steps), error,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "saga journal: failed to persist state for task %s saga %s: %s",
            task_id, saga_name, exc,
        )


async def recover_orphaned_sagas(staleness: timedelta = ORPHAN_STALENESS) -> int:
    """Mark stale "running" saga journal rows as orphaned.

    Called on worker startup and periodically from Celery beat (see
    app/tasks/automation.py's ``recover_orphaned_sagas`` task and
    celery_app.py's beat_schedule). Does NOT attempt to resume the saga or
    replay compensation — see this module's docstring for why that's
    impossible in principle for this codebase's only current saga (its
    steps act on a live browser page that died with the crashed worker).
    Returns the number of rows marked orphaned.
    """
    pool = await _get_pool_safe()
    if not pool:
        return 0
    cutoff = datetime.now(timezone.utc) - staleness
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                UPDATE saga_journal
                SET status = 'orphaned',
                    error = 'worker crashed or restarted mid-saga; the browser session is unrecoverable, retry the whole flow',
                    completed_at = now(),
                    updated_at = now()
                WHERE status = 'running' AND updated_at < $1
                RETURNING task_id, saga_name
                """,
                cutoff,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("saga journal: orphan sweep failed: %s", exc)
        return 0
    if rows:
        logger.warning(
            "saga journal: marked %d saga(s) orphaned (no update since %s): %s",
            len(rows), cutoff.isoformat(),
            [f"{r['task_id']}/{r['saga_name']}" for r in rows],
        )
    return len(rows)


@dataclass
class SagaContext:
    """Orchestrator context for managing and executing a sequence of saga steps."""

    task_id: str
    user_id: str
    saga_name: str = "default"
    steps: list[SagaStep] = field(default_factory=list)
    completed_steps: list[SagaStep] = field(default_factory=list)

    def add_step(
        self,
        name: str,
        execute: Callable[..., Coroutine[Any, Any, Any]],
        compensate: Callable[..., Coroutine[Any, Any, Any]] | None = None,
        resumable: bool = False,
    ) -> SagaStep:
        """Add a step to the execution pipeline."""
        step = SagaStep(name=name, execute=execute, compensate=compensate, resumable=resumable)
        self.steps.append(step)
        return step

    def _journal_snapshot(self) -> list[dict]:
        return [_step_snapshot(s) for s in self.steps]

    async def run(self) -> dict[str, Any]:
        """Execute all steps sequentially.

        If any step raises an exception:
          - Marks step.status = FAILED, step.error = str(e)
          - Runs compensation in reverse order for completed steps
          - Returns {"success": False, "failed_step": step.name, "error": step.error, "compensated": [...]}

        If all succeed:
          - Returns {"success": True, "steps_completed": [...]}

        Every transition is journaled (best-effort, never fatal to the saga
        itself — see _journal_upsert).
        """
        await _journal_upsert(
            self.task_id, self.user_id, self.saga_name,
            SagaStatus.RUNNING, self._journal_snapshot(),
        )

        for step in self.steps:
            step.status = StepStatus.RUNNING
            await _journal_upsert(
                self.task_id, self.user_id, self.saga_name,
                SagaStatus.RUNNING, self._journal_snapshot(),
            )
            try:
                res = step.execute()
                if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                    step.result = await res
                else:
                    step.result = res
                step.status = StepStatus.COMPLETED
                self.completed_steps.append(step)
                await _journal_upsert(
                    self.task_id, self.user_id, self.saga_name,
                    SagaStatus.RUNNING, self._journal_snapshot(),
                )
            except Exception as exc:
                step.status = StepStatus.FAILED
                step.error = str(exc)
                logger.warning(
                    "[Saga %s] Step '%s' failed for user %s: %s",
                    self.task_id,
                    step.name,
                    self.user_id,
                    exc,
                )
                await _journal_upsert(
                    self.task_id, self.user_id, self.saga_name,
                    SagaStatus.RUNNING, self._journal_snapshot(), error=step.error,
                )
                compensated = await self._compensate()
                await _journal_upsert(
                    self.task_id, self.user_id, self.saga_name,
                    SagaStatus.FAILED, self._journal_snapshot(), error=step.error,
                )
                return {
                    "success": False,
                    "failed_step": step.name,
                    "error": step.error,
                    "compensated": compensated,
                }

        await _journal_upsert(
            self.task_id, self.user_id, self.saga_name,
            SagaStatus.COMPLETED, self._journal_snapshot(),
        )
        return {
            "success": True,
            "steps_completed": [s.name for s in self.completed_steps],
        }

    async def _compensate(self) -> list[str]:
        """Iterate in reverse over completed steps and trigger compensation.

        Compensation exceptions are caught, logged, and will not abort or crash the saga.
        Returns the list of step names that were successfully compensated.
        """
        compensated_names: list[str] = []
        for step in reversed(self.completed_steps):
            if step.compensate is not None:
                try:
                    res = step.compensate()
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res
                    step.status = StepStatus.COMPENSATED
                    compensated_names.append(step.name)
                    await _journal_upsert(
                        self.task_id, self.user_id, self.saga_name,
                        SagaStatus.RUNNING, self._journal_snapshot(),
                    )
                except Exception as exc:
                    logger.error(
                        "[Saga %s] Compensation failed for step '%s' (user %s): %s",
                        self.task_id,
                        step.name,
                        self.user_id,
                        exc,
                        exc_info=True,
                    )
        return compensated_names
