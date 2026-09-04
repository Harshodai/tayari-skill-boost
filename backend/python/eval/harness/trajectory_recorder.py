"""Trajectory Recorder for Multi-Step Agent Actions.

Records detailed execution traces of agent steps:
{step_index, tool_called, tool_args, tool_result, model, latency_ms, tokens, cost_usd, intermediate_state}.

Enforces ZERO runtime overhead in production:
Recording is completely bypassed unless EVAL_MODE=true or an explicit active session is passed.
"""
from __future__ import annotations

import contextvars
import functools
import inspect
import json
import logging
import os
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Dict, List, Optional, TypeVar, cast

logger = logging.getLogger(__name__)

# Context variable for thread/async-safe trajectory propagation
_current_recorder: contextvars.ContextVar[Optional[TrajectoryRecorder]] = contextvars.ContextVar(
    "current_trajectory_recorder", default=None
)

# Cost estimation per 1k tokens (blended input/output approximation)
MODEL_COST_PER_1K_TOKENS: dict[str, float] = {
    "openai/gpt-4o-mini": 0.0003,
    "gpt-4o-mini": 0.0003,
    "meta/llama-3.1-70b-instruct": 0.0005,
    "llama-3.1-70b": 0.0005,
    "anthropic/claude-3-5-sonnet": 0.006,
    "claude-3-5-sonnet": 0.006,
    "hermes": 0.0001,
    "default": 0.0005,
}


def is_eval_active() -> bool:
    """Check whether evaluation recording is enabled via environment or context."""
    val = os.environ.get("EVAL_MODE", "").strip().lower()
    return val in ("true", "1", "yes", "on")


def estimate_cost_usd(model: str, tokens: int) -> float:
    """Estimate USD cost based on token volume and model name."""
    if tokens <= 0:
        return 0.0
    normalized_model = (model or "").lower().strip()
    rate = MODEL_COST_PER_1K_TOKENS.get(normalized_model)
    if rate is None:
        for known_prefix, r in MODEL_COST_PER_1K_TOKENS.items():
            if known_prefix in normalized_model:
                rate = r
                break
    if rate is None:
        rate = MODEL_COST_PER_1K_TOKENS["default"]
    return round((tokens / 1000.0) * rate, 6)


@dataclass
class AgentActionStep:
    """Single recorded step within an agent's multi-step execution trajectory."""
    step_index: int
    tool_called: str
    tool_args: dict[str, Any] = field(default_factory=dict)
    tool_result: Any = None
    model: str = "default"
    latency_ms: float = 0.0
    tokens: int = 0
    cost_usd: float = 0.0
    intermediate_state: Optional[dict[str, Any]] = None
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        """Convert step to a clean JSON-serializable dictionary."""
        d = asdict(self)
        return d


@dataclass
class Trajectory:
    """Complete multi-step trajectory record for an agent execution session."""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "agent_run"
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    steps: list[AgentActionStep] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    final_output: Any = None

    @property
    def total_latency_ms(self) -> float:
        """Sum of all step latencies in milliseconds."""
        return sum(s.latency_ms for s in self.steps)

    @property
    def total_tokens(self) -> int:
        """Total tokens consumed across all recorded steps."""
        return sum(s.tokens for s in self.steps)

    @property
    def total_cost_usd(self) -> float:
        """Total estimated cost in USD across all recorded steps."""
        return round(sum(s.cost_usd for s in self.steps), 6)

    def add_step(self, step: AgentActionStep) -> None:
        """Append an action step to the trajectory."""
        self.steps.append(step)

    def to_dict(self) -> dict[str, Any]:
        """Convert entire trajectory to dictionary representation."""
        return {
            "session_id": self.session_id,
            "name": self.name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "total_latency_ms": round(self.total_latency_ms, 2),
            "total_tokens": self.total_tokens,
            "total_cost_usd": self.total_cost_usd,
            "step_count": len(self.steps),
            "metadata": self.metadata,
            "final_output": self.final_output,
            "steps": [s.to_dict() for s in self.steps],
        }

    def to_json(self, indent: int = 2) -> str:
        """Serialize trajectory to JSON string."""
        return json.dumps(self.to_dict(), indent=indent, default=str)


class TrajectoryRecorder:
    """Context manager and controller for recording execution trajectories.

    In production (when EVAL_MODE is not active and active=False), this class
    operates with zero overhead: calls to record_step are immediate no-ops.
    """

    def __init__(
        self,
        name: str = "agent_execution",
        session_id: Optional[str] = None,
        active: Optional[bool] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        self.is_active = is_eval_active() if active is None else bool(active)
        self.name = name
        self.session_id = session_id or str(uuid.uuid4())
        self.metadata = metadata or {}
        self.trajectory = Trajectory(
            session_id=self.session_id,
            name=self.name,
            metadata=self.metadata,
        )
        self._reset_token: Optional[contextvars.Token] = None

    def __enter__(self) -> TrajectoryRecorder:
        if not self.is_active:
            return self
        self._reset_token = _current_recorder.set(self)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if not self.is_active:
            return
        self.trajectory.end_time = time.time()
        if self._reset_token is not None:
            _current_recorder.reset(self._reset_token)
            self._reset_token = None

    def record_step(
        self,
        tool_called: str,
        tool_args: Optional[dict[str, Any]] = None,
        tool_result: Any = None,
        model: str = "default",
        latency_ms: float = 0.0,
        tokens: int = 0,
        cost_usd: Optional[float] = None,
        intermediate_state: Optional[dict[str, Any]] = None,
    ) -> Optional[AgentActionStep]:
        """Record an agent step. Zero overhead if recorder is inactive."""
        if not self.is_active:
            return None

        step_idx = len(self.trajectory.steps) + 1
        if cost_usd is None:
            cost_usd = estimate_cost_usd(model, tokens)

        step = AgentActionStep(
            step_index=step_idx,
            tool_called=tool_called,
            tool_args=tool_args or {},
            tool_result=tool_result,
            model=model,
            latency_ms=round(latency_ms, 2),
            tokens=tokens,
            cost_usd=cost_usd,
            intermediate_state=intermediate_state,
        )
        self.trajectory.add_step(step)
        return step

    def set_final_output(self, output: Any) -> None:
        """Set the final returned output for the trajectory."""
        if not self.is_active:
            return
        self.trajectory.final_output = output

    def get_trajectory(self) -> Trajectory:
        """Retrieve the recorded trajectory."""
        return self.trajectory


def get_current_recorder() -> Optional[TrajectoryRecorder]:
    """Retrieve the currently active TrajectoryRecorder from contextvar."""
    return _current_recorder.get()


F = TypeVar("F", bound=Callable[..., Any])


def record_trajectory(
    tool_name: Optional[str] = None,
    model: str = "default",
    estimate_tokens: bool = True,
) -> Callable[[F], F]:
    """Decorator to record tool/function calls into the current TrajectoryRecorder.

    Zero overhead when no recorder is active or EVAL_MODE is not enabled.
    Supports both synchronous and asynchronous functions.
    """
    def decorator(func: F) -> F:
        name = tool_name or func.__name__

        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                rec = get_current_recorder()
                if rec is None or not rec.is_active:
                    return await func(*args, **kwargs)

                t0 = time.perf_counter()
                result = None
                error = None
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as exc:
                    error = str(exc)
                    raise
                finally:
                    latency_ms = (time.perf_counter() - t0) * 1000.0
                    token_count = 0
                    if estimate_tokens:
                        # Rough heuristic: 1 token ~ 4 chars of stringified args + output
                        arg_str = str(kwargs) + "".join(str(a) for a in args[:2])
                        res_str = str(result or error or "")
                        token_count = max(len(arg_str) // 4 + len(res_str) // 4, 10)

                    rec.record_step(
                        tool_called=name,
                        tool_args={k: str(v)[:200] for k, v in kwargs.items()},
                        tool_result=result if error is None else {"error": error},
                        model=model,
                        latency_ms=latency_ms,
                        tokens=token_count,
                    )
            return cast(F, async_wrapper)
        else:
            @functools.wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                rec = get_current_recorder()
                if rec is None or not rec.is_active:
                    return func(*args, **kwargs)

                t0 = time.perf_counter()
                result = None
                error = None
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as exc:
                    error = str(exc)
                    raise
                finally:
                    latency_ms = (time.perf_counter() - t0) * 1000.0
                    token_count = 0
                    if estimate_tokens:
                        arg_str = str(kwargs) + "".join(str(a) for a in args[:2])
                        res_str = str(result or error or "")
                        token_count = max(len(arg_str) // 4 + len(res_str) // 4, 10)

                    rec.record_step(
                        tool_called=name,
                        tool_args={k: str(v)[:200] for k, v in kwargs.items()},
                        tool_result=result if error is None else {"error": error},
                        model=model,
                        latency_ms=latency_ms,
                        tokens=token_count,
                    )
            return cast(F, sync_wrapper)

    return decorator
