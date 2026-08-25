"""Deterministic orchestration policy primitives for Tayari AI runs.

This module deliberately does not call a model or execute a tool. It provides
stable policy decisions that callers can test, trace, and enforce:

* named quality tiers map to configured provider model suffixes;
* bounded fan-out runs isolate child failures and preserve per-step trace data;
* no implicit provider fallback or autonomous sensitive action is introduced.

The implementation is intentionally dependency-light so it can be used by
FastAPI requests, Celery workers, and unit tests without importing an agent SDK.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Iterable


SUPPORTED_TIERS = ("cheap", "fast", "smart", "deep", "hermes")
TIER_ALIASES = {
    "default": "fast",
    "balanced": "fast",
    "reasoning": "smart",
    "max": "deep",
}


@dataclass(frozen=True)
class RoutingDecision:
    """A serializable routing decision made before a model call."""

    requested_tier: str
    resolved_tier: str
    task_kind: str
    rationale: str


def normalize_tier(tier: str | None) -> str:
    """Normalize a caller tier while failing closed to the safe fast tier."""
    requested = str(tier or "fast").strip().lower()
    resolved = TIER_ALIASES.get(requested, requested)
    return resolved if resolved in SUPPORTED_TIERS else "fast"


def choose_tier(tier: str | None = None, task_kind: str | None = None) -> RoutingDecision:
    """Choose a named tier using explicit caller intent and conservative defaults.

    Explicit supported tiers always win. Task-kind routing only applies when a
    caller omitted a tier (or used the legacy ``default`` alias), so existing
    deployments never change model behavior silently.
    """
    requested = str(tier or "").strip().lower()
    kind = str(task_kind or "general").strip().lower() or "general"
    if requested and requested not in {"default", "balanced"}:
        resolved = normalize_tier(requested)
        return RoutingDecision(requested or "fast", resolved, kind, "explicit caller tier")

    if kind in {"classification", "tagging", "bulk_extract", "summarize", "embedding"}:
        return RoutingDecision(requested or "fast", "cheap", kind, "high-volume deterministic task")
    if kind in {"optimization", "deep_analysis", "agent_plan", "evaluation", "counterfactual"}:
        return RoutingDecision(requested or "fast", "smart", kind, "reasoning-sensitive task")
    if kind in {"hard_reasoning", "judge", "safety_review"}:
        return RoutingDecision(requested or "fast", "deep", kind, "high-stakes reasoning task")
    if kind in {"scrape", "provider_search"}:
        return RoutingDecision(requested or "fast", "hermes", kind, "provider orchestration task")
    return RoutingDecision(requested or "fast", "fast", kind, "general interactive task")


@dataclass(frozen=True)
class SwarmStep:
    """One bounded, reviewable specialist step in a swarm run."""

    step_id: str
    role: str
    input: Any


@dataclass
class SwarmOutcome:
    """A failure-isolated result for one swarm child."""

    step_id: str
    role: str
    status: str
    output: Any = None
    error: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


async def run_bounded_swarm(
    steps: Iterable[SwarmStep],
    worker: Callable[[SwarmStep], Awaitable[Any]],
    *,
    max_parallel: int = 3,
    timeout_seconds: float = 120.0,
) -> list[SwarmOutcome]:
    """Run independent specialist steps with bounded concurrency and traceable failure.

    This is a fan-out/fan-in harness, not unconstrained autonomy. It enforces a
    small maximum batch, uses a semaphore, applies a per-child timeout, and
    returns explicit ``failed``/``timed_out`` statuses instead of swallowing
    errors or claiming completion. Child inputs remain caller-owned and are not
    persisted or sent anywhere by this function.
    """
    materialized = list(steps)
    if not materialized:
        return []
    if len(materialized) > 12:
        raise ValueError("swarm batch exceeds the maximum of 12 specialist steps")
    if max_parallel < 1 or max_parallel > 6:
        raise ValueError("max_parallel must be between 1 and 6")
    if timeout_seconds <= 0 or timeout_seconds > 600:
        raise ValueError("timeout_seconds must be between 0 and 600")

    semaphore = asyncio.Semaphore(max_parallel)

    async def one(step: SwarmStep) -> SwarmOutcome:
        started = datetime.now(timezone.utc).isoformat()
        async with semaphore:
            try:
                output = await asyncio.wait_for(worker(step), timeout=timeout_seconds)
                return SwarmOutcome(
                    step_id=step.step_id,
                    role=step.role,
                    status="completed",
                    output=output,
                    started_at=started,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                )
            except asyncio.TimeoutError:
                return SwarmOutcome(
                    step_id=step.step_id,
                    role=step.role,
                    status="timed_out",
                    error="specialist step exceeded its timeout",
                    started_at=started,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                )
            except asyncio.CancelledError:
                return SwarmOutcome(
                    step_id=step.step_id,
                    role=step.role,
                    status="cancelled",
                    error="swarm run was cancelled",
                    started_at=started,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                )
            except Exception as exc:  # noqa: BLE001 - failure is part of the result contract
                return SwarmOutcome(
                    step_id=step.step_id,
                    role=step.role,
                    status="failed",
                    error=str(exc)[:240] or exc.__class__.__name__,
                    started_at=started,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                )

    # Preserve declared order so fan-in is deterministic even when children finish
    # out of order. The caller can still inspect timestamps for execution timing.
    return list(await asyncio.gather(*(one(step) for step in materialized)))


__all__ = [
    "RoutingDecision",
    "SUPPORTED_TIERS",
    "SwarmOutcome",
    "SwarmStep",
    "choose_tier",
    "normalize_tier",
    "run_bounded_swarm",
]
