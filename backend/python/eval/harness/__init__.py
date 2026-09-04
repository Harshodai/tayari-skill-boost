"""Tayari Evaluation Harness ("Own Harness").

Provides trajectory recording, decoupled LLM/heuristic judging, structured rubrics,
and fail-closed CI gates for evaluating generative AI agents and pipelines.
"""
from eval.harness.trajectory_recorder import (
    AgentActionStep,
    Trajectory,
    TrajectoryRecorder,
    record_trajectory,
    is_eval_active,
)
from eval.harness.llm_judge import (
    LLMJudge,
    Rubric,
    EvalResult,
    load_rubric,
)

__all__ = [
    "AgentActionStep",
    "Trajectory",
    "TrajectoryRecorder",
    "record_trajectory",
    "is_eval_active",
    "LLMJudge",
    "Rubric",
    "EvalResult",
    "load_rubric",
]
