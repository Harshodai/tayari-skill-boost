"""
Milestone 2: Hard Validation Gate & Deterministic Conditional Edge Router.

Implements DGM (arXiv:2505.22954 §4 — Hard Syntax Gates):
- Every LLM output is validated against its Pydantic schema BEFORE any state update.
- Validation failure increments syntax_errors_encountered counter.
- After max_iterations (hard ceiling: 3), route = 'terminal_failure' — STOP.
  This prevents infinite API token bleeding.
- The LLM has ZERO permission to set the 'route' field — only this module writes it.
- All routing is deterministic Python conditional logic — no LLM conversational output.

DGM lineage: every validation attempt (pass or fail) is recorded in state.lineage[]
for the outer-loop optimizer to analyze from raw failure traces (Meta-Harness §3).
"""
from __future__ import annotations

import time
from typing import Any, Dict, Literal, Optional, Type

from pydantic import BaseModel, ValidationError

from app.unhobbling.state import (
    ExecutionResultDict,
    JobTayariHarnessState,
    LineageEntry,
)
from app.unhobbling.signatures import HarnessSignatureRegistry


def _build_lineage_entry(
    state: JobTayariHarnessState,
    passed: bool,
    validation_error: Optional[str] = None,
    repair_rationale: Optional[str] = None,
) -> LineageEntry:
    """Build a DGM lineage audit record for the current attempt."""
    exec_result: Optional[ExecutionResultDict] = state.get("execution_result")
    code = state.get("code_to_execute") or ""
    import hashlib
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    return LineageEntry(
        attempt=state["current_iteration"],
        timestamp_utc=time.time(),
        code_hash=code_hash,
        code_snippet=code[:500],
        validation_error=validation_error,
        execution_error=exec_result.get("error") if exec_result else None,
        stdout_trace=exec_result.get("stdout", "") if exec_result else "",
        pydantic_schema=state.get("dspy_signature_class", "unknown"),
        passed=passed,
        repair_rationale=repair_rationale,
    )


def hard_validation_gate(
    state: JobTayariHarnessState,
    llm_output: Optional[Dict[str, Any]] = None,
) -> JobTayariHarnessState:
    """
    DGM Hard Validation Gate (arXiv:2505.22954 §4).

    Validates `llm_output` (or `state['pydantic_output']`) against the Pydantic
    schema registered for `state['task_type']`.

    On success: sets validation_passed=True, route='log', records lineage.
    On failure: increments syntax_errors_encountered, sets validation_passed=False,
                records full error trace in lineage, sets route='repair' or 'terminal_failure'.

    NEVER raises — always returns a valid updated state.
    """
    task_type = state["task_type"]
    current_iter = state["current_iteration"] + 1
    errors_so_far = state["syntax_errors_encountered"]
    max_iters = state["max_iterations"]

    # Resolve the output to validate
    output_to_validate = llm_output or state.get("pydantic_output")

    if output_to_validate is None:
        # No output provided — treat as validation failure
        error_msg = "ValidationError: No output provided to validate."
        lineage_entry = _build_lineage_entry(state, passed=False, validation_error=error_msg)
        new_lineage = list(state["lineage"]) + [lineage_entry]
        new_errors = errors_so_far + 1
        route: Literal["repair", "terminal_failure"] = (
            "terminal_failure" if new_errors >= max_iters else "repair"
        )
        return JobTayariHarnessState(**{
            **state,
            "current_iteration": current_iter,
            "syntax_errors_encountered": new_errors,
            "validation_passed": False,
            "validation_error_message": error_msg,
            "pydantic_output": None,
            "lineage": new_lineage,
            "route": route,
        })

    # Attempt Pydantic validation
    try:
        schema_cls: Type[BaseModel] = HarnessSignatureRegistry.get(task_type)

        # Accept both dict and already-validated model
        if isinstance(output_to_validate, BaseModel):
            validated = schema_cls.model_validate(output_to_validate.model_dump()).model_dump()
        else:
            validated_model = schema_cls.model_validate(output_to_validate)
            validated = validated_model.model_dump()

        lineage_entry = _build_lineage_entry(state, passed=True)
        new_lineage = list(state["lineage"]) + [lineage_entry]

        return JobTayariHarnessState(**{
            **state,
            "current_iteration": current_iter,
            "validation_passed": True,
            "validation_error_message": None,
            "pydantic_output": validated,
            "lineage": new_lineage,
            "route": "log",
        })

    except ValidationError as exc:
        error_msg = str(exc)
        new_errors = errors_so_far + 1

        lineage_entry = _build_lineage_entry(state, passed=False, validation_error=error_msg)
        new_lineage = list(state["lineage"]) + [lineage_entry]

        # DGM hard gate: after max_iterations failures, terminate — no more API calls
        route = "terminal_failure" if new_errors >= max_iters else "repair"

        return JobTayariHarnessState(**{
            **state,
            "current_iteration": current_iter,
            "syntax_errors_encountered": new_errors,
            "validation_passed": False,
            "validation_error_message": error_msg,
            "error_trace": error_msg,
            "lineage": new_lineage,
            "route": route,
        })

    except Exception as exc:  # noqa: BLE001
        # Unexpected errors (schema lookup failure, etc.) → terminal failure
        error_msg = f"UnexpectedValidationError: {type(exc).__name__}: {exc}"
        new_errors = errors_so_far + 1
        lineage_entry = _build_lineage_entry(state, passed=False, validation_error=error_msg)
        new_lineage = list(state["lineage"]) + [lineage_entry]
        return JobTayariHarnessState(**{
            **state,
            "current_iteration": current_iter,
            "syntax_errors_encountered": new_errors,
            "validation_passed": False,
            "validation_error_message": error_msg,
            "error_trace": error_msg,
            "lineage": new_lineage,
            "route": "terminal_failure",
        })


def deterministic_conditional_edge(
    state: JobTayariHarnessState,
) -> Literal["execute", "validate", "repair", "log", "complete", "terminal_failure"]:
    """
    DGM Deterministic Conditional Edge (arXiv:2505.22954 §4).

    THIS IS THE ONLY FUNCTION THAT DETERMINES CONTROL FLOW.
    The LLM has NO input to this function — it reads State parameters only.

    Routing logic:
      validation_passed=True                           → 'complete'
      validation_passed=False AND errors < max_iters   → 'repair'
      validation_passed=False AND errors >= max_iters  → 'terminal_failure' (hard stop)
      route set to 'terminal_failure' explicitly       → 'terminal_failure'
      route set to 'execute'                           → 'execute'
      route set to 'validate'                          → 'validate'
      route set to 'log'                               → 'log'
    """
    # Hard terminal failure overrides everything
    if state["route"] == "terminal_failure":
        return "terminal_failure"

    # DGM §4: errors >= max_iterations → hard stop regardless of route
    if state["syntax_errors_encountered"] >= state["max_iterations"]:
        return "terminal_failure"

    # Validation passed → proceed to completion
    if state["validation_passed"]:
        return "complete"

    # Explicit route signals (set by orchestrator nodes, never by LLM)
    current_route = state["route"]
    if current_route in ("execute", "validate", "repair", "log", "complete"):
        # If we have failures but route says repair, honor it (within iterations)
        return current_route  # type: ignore[return-value]

    # Default: if not passed and not terminal, send to repair
    return "repair"
