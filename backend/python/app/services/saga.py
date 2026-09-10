"""Saga Pattern for Browser Automation and Distributed Workflows (Tier 2 — D2).

Provides linear saga execution with compensating transactions. If any step fails,
previously completed steps are compensated in reverse order to ensure consistent
state and clean rollback.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


class StepStatus(str, Enum):
    """Execution status for an individual saga step."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATED = "compensated"


@dataclass
class SagaStep:
    """A single step in a saga, with forward execution and optional backward compensation."""

    name: str
    execute: Callable[..., Coroutine[Any, Any, Any]]
    compensate: Callable[..., Coroutine[Any, Any, Any]] | None = None
    status: StepStatus = StepStatus.PENDING
    result: Any = None
    error: str | None = None


@dataclass
class SagaContext:
    """Orchestrator context for managing and executing a sequence of saga steps."""

    task_id: str
    user_id: str
    steps: list[SagaStep] = field(default_factory=list)
    completed_steps: list[SagaStep] = field(default_factory=list)

    def add_step(
        self,
        name: str,
        execute: Callable[..., Coroutine[Any, Any, Any]],
        compensate: Callable[..., Coroutine[Any, Any, Any]] | None = None,
    ) -> SagaStep:
        """Add a step to the execution pipeline."""
        step = SagaStep(name=name, execute=execute, compensate=compensate)
        self.steps.append(step)
        return step

    async def run(self) -> dict[str, Any]:
        """Execute all steps sequentially.

        If any step raises an exception:
          - Marks step.status = FAILED, step.error = str(e)
          - Runs compensation in reverse order for completed steps
          - Returns {"success": False, "failed_step": step.name, "error": step.error, "compensated": [...]}

        If all succeed:
          - Returns {"success": True, "steps_completed": [...]}
        """
        for step in self.steps:
            step.status = StepStatus.RUNNING
            try:
                res = step.execute()
                if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                    step.result = await res
                else:
                    step.result = res
                step.status = StepStatus.COMPLETED
                self.completed_steps.append(step)
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
                compensated = await self._compensate()
                return {
                    "success": False,
                    "failed_step": step.name,
                    "error": step.error,
                    "compensated": compensated,
                }

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
