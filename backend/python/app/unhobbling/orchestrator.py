"""
JobTayari Deterministic State Orchestrator — LangGraph-Compatible.

Design principles:
- The LLM is a stateless computing node — it receives typed schema context and returns
  typed output. It has ZERO permission to route control flow.
- All conditional edges are hardcoded Python logic in router.deterministic_conditional_edge().
- temperature=0.0 is MANDATORY on all extraction/validation nodes.
- The orchestrator is LangGraph-compatible: StateGraph pattern with TypedDict state,
  but implemented in pure Python to avoid the langgraph dependency in the base image.
  Drop-in replacement with langgraph.graph.StateGraph when installed.

Graph topology:
    [START]
       ↓
  [virtualize_context_node]  — stores text in state variables, builds handles
       ↓
  [generate_code_action_node]  — LLM generates Python code (CodeActionOutput)
       ↓
  [execute_sandbox_node]  — runs code in VirtualizedREPL, captures stdout
       ↓
  [validate_output_node]  — hard_validation_gate() checks Pydantic schema
       ↓ (conditional edge)
  ┌─── "complete" ──────────────────→ [log_and_complete_node]
  ├─── "repair"   ──────────────────→ [repair_code_node] → [execute_sandbox_node]
  └─── "terminal_failure" ──────────→ [log_terminal_failure_node]
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, Optional

from app.services.llm_service import llm_json
from app.unhobbling.state import (
    JobTayariHarnessState,
    new_state,
    add_context_variable,
)
from app.unhobbling.repl_gate import execute_sandbox_code
from app.unhobbling.router import hard_validation_gate, deterministic_conditional_edge
from app.unhobbling.logging_middleware import HierarchicalLoggingMiddleware
from app.unhobbling.signatures import (
    CodeActionOutput,
    CodeRepairOutput,
    HarnessSignatureRegistry,
)

logger = logging.getLogger("tayari.unhobbling.orchestrator")

# LLM callable type — async function matching llm_service.llm_json signature
LLMCallable = Callable[..., Any]


class MockLLMCallable:
    """
    Mock LLM for testing and offline evaluation.
    Returns minimal valid output for each signature type.
    temperature=0.0 — fully deterministic.
    """

    async def generate_code_action(
        self,
        state: JobTayariHarnessState,
    ) -> Dict[str, Any]:
        """Generate a simple skill-extraction code action."""
        handles = list(state["variable_handles"].keys())
        resume_key = next((k for k in handles if "resume" in k.lower()), handles[0] if handles else "resume")
        jd_key = next((k for k in handles if "jd" in k.lower() or "job" in k.lower()), handles[-1] if handles else "jd")
        return {
            "code_to_execute": (
                f"resume_text = get_variable({resume_key!r})\n"
                f"jd_text = get_variable({jd_key!r})\n"
                f"resume_words = set(resume_text.lower().split())\n"
                f"jd_words = set(jd_text.lower().split())\n"
                f"result = {{\n"
                f"    'resume_handle_key': {resume_key!r},\n"
                f"    'jd_handle_key': {jd_key!r},\n"
                f"    'extracted_skills': [],\n"
                f"    'required_skills': sorted(list(jd_words - resume_words))[:10],\n"
                f"    'missing_skills': sorted(list(jd_words - resume_words))[:5],\n"
                f"    'transferable_skills': sorted(list(resume_words & jd_words))[:5],\n"
                f"    'match_score': round(len(resume_words & jd_words) / max(len(jd_words), 1), 4),\n"
                f"    'confidence': 'medium',\n"
                f"    'token_budget_used': token_count({resume_key!r}) + token_count({jd_key!r}),\n"
                f"}}"
            ),
            "expected_output_type": "dict",
            "rationale": "Extract skill overlap between resume and JD via set operations on variable handles.",
            "uses_variables": [resume_key, jd_key],
        }

    async def generate_repair(
        self,
        state: JobTayariHarnessState,
    ) -> Dict[str, Any]:
        """Generate a repair for failed code."""
        return {
            "repaired_code": (
                "result = {\n"
                "    'resume_handle_key': list_variables()[0] if list_variables() else 'resume',\n"
                "    'jd_handle_key': list_variables()[-1] if list_variables() else 'jd',\n"
                "    'extracted_skills': [],\n"
                "    'required_skills': [],\n"
                "    'missing_skills': [],\n"
                "    'transferable_skills': [],\n"
                "    'match_score': 0.0,\n"
                "    'confidence': 'low',\n"
                "    'token_budget_used': 0,\n"
                "}"
            ),
            "diagnosis": "Fallback repair: previous code failed REPL execution or Pydantic validation.",
            "patch_rationale": "Using safe fallback with list_variables() to avoid KeyError.",
            "confidence": "low",
        }


class RealLLMCallable:
    """Production LLM adapter that uses llm_service.llm_json()."""

    async def generate_code_action(self, state: JobTayariHarnessState) -> Dict[str, Any]:
        schema = HarnessSignatureRegistry.schema_for_llm("code_action")
        handles_context = {k: v for k, v in state["variable_handles"].items()}
        system_prompt = (
            f"You are a Python code generator. Generate code that operates on variable handles "
            f"using these functions: get_variable(key), slice_variable(key, start, end), "
            f"search_variable(key, pattern), token_count(key), list_variables(). "
            f"Available variables: {json.dumps(handles_context, default=str)}. "
            f"Task: {state['task_type']}. Target role: {state['target_role']}. "
            f"Output must conform to this JSON schema: {json.dumps(schema)}"
        )
        result = await llm_json(system_prompt, json.dumps(schema), temperature=0.0)
        return result

    async def generate_repair(self, state: JobTayariHarnessState) -> Dict[str, Any]:
        schema = HarnessSignatureRegistry.schema_for_llm("code_repair")
        system_prompt = (
            f"The following code failed: {state.get('code_to_execute', '')[:500]}. "
            f"Error: {state.get('error_trace', '')}. "
            f"Validation error: {state.get('validation_error_message', '')}. "
            f"Generate repaired code. Output JSON schema: {json.dumps(schema)}"
        )
        result = await llm_json(system_prompt, json.dumps(schema), temperature=0.0)
        return result


__all__ = [
    "LLMCallable",
    "MockLLMCallable",
    "RealLLMCallable",
    "JobTayariOrchestrator",
]


class JobTayariOrchestrator:
    """
    Deterministic State Orchestrator for the JobTayari harness.

    Implements the LangGraph StateGraph pattern in pure Python.
    When langgraph is installed, use langgraph.graph.StateGraph instead
    by replacing this class — the state schema and node signatures are compatible.
    """

    def __init__(
        self,
        llm: Optional[Any] = None,
    ) -> None:
        self._llm = llm or MockLLMCallable()

    async def run(
        self,
        user_id: str,
        context_inputs: Dict[str, str],
        task_type: str = "skill_extraction",
        target_role: str = "",
        max_iterations: int = 3,
    ) -> JobTayariHarnessState:
        """
        Execute the full harness graph for one user request.

        Args:
            user_id: Owner user ID (qm tenant isolation).
            context_inputs: Dict of {variable_key: raw_text} to store in state.
            task_type: DSPy signature type to use.
            target_role: Job role for context.
            max_iterations: Hard limit on repair attempts (max 3).

        Returns:
            Final JobTayariHarnessState after graph traversal.
        """
        # Initialize state
        state = new_state(
            user_id=user_id,
            task_type=task_type,
            target_role=target_role,
            max_iterations=min(max_iterations, 3),
        )

        # Store context variables (RLM: heavy text → state variables, not LLM context)
        for key, text in context_inputs.items():
            state = add_context_variable(state, key, text)

        with HierarchicalLoggingMiddleware(state) as log:
            try:
                state = await self._graph_execute(state, log)
            except Exception as exc:  # noqa: BLE001
                logger.error("Orchestrator graph error: %s", exc)
                state = JobTayariHarnessState(**{
                    **state,
                    "route": "terminal_failure",
                    "error_trace": f"{type(exc).__name__}: {exc}",
                })
                log.record_step("exception_handler", state)

        return state

    async def _graph_execute(
        self,
        state: JobTayariHarnessState,
        log: HierarchicalLoggingMiddleware,
    ) -> JobTayariHarnessState:
        """Execute the deterministic state graph loop."""

        # Node 1: Generate code action
        state = await self._node_generate_code_action(state)
        log.record_step("generate_code_action", state)

        # Repair loop — bounded by max_iterations
        while True:
            route = deterministic_conditional_edge(state)

            if route == "terminal_failure":
                state = self._node_terminal_failure(state)
                log.record_step("terminal_failure", state)
                break

            if route == "complete":
                state = self._node_complete(state)
                log.record_step("complete", state)
                break

            if route in ("execute", "repair"):
                if route == "repair" and state["code_to_execute"]:
                    # Generate repaired code
                    state = await self._node_repair_code(state)
                    log.record_step("repair_code", state)

                # Execute in sandbox
                state = self._node_execute_sandbox(state)
                log.record_step("execute_sandbox", state)

                # Validate output
                state = self._node_validate_output(state)
                log.record_step("validate_output", state)
                continue

            if route == "validate":
                state = self._node_validate_output(state)
                log.record_step("validate_output", state)
                continue

            if route == "log":
                # Validation passed, move to complete
                state = JobTayariHarnessState(**{**state, "route": "complete"})
                continue

            # Safety: unknown route → terminal failure
            state = JobTayariHarnessState(**{
                **state,
                "route": "terminal_failure",
                "error_trace": f"UnknownRoute: '{route}'",
            })
            break

        return state

    async def _node_generate_code_action(
        self, state: JobTayariHarnessState
    ) -> JobTayariHarnessState:
        """LLM node: generate Python code to operate on variable handles (CodeActionOutput)."""
        try:
            raw_output = await self._llm.generate_code_action(state)
            # Validate through DSPy gate before storing
            validated = CodeActionOutput.model_validate(raw_output)
            return JobTayariHarnessState(**{
                **state,
                "code_to_execute": validated.code_to_execute,
                "llm_raw_output": str(raw_output),
                "dspy_signature_class": "CodeActionOutput",
                "route": "execute",
            })
        except Exception as exc:  # noqa: BLE001
            return JobTayariHarnessState(**{
                **state,
                "code_to_execute": None,
                "error_trace": f"CodeGenError: {exc}",
                "route": "terminal_failure" if state["syntax_errors_encountered"] >= state["max_iterations"] else "terminal_failure",
            })

    def _node_execute_sandbox(self, state: JobTayariHarnessState) -> JobTayariHarnessState:
        """REPL execution node: run code_to_execute in VirtualizedREPL sandbox."""
        code = state.get("code_to_execute")
        if not code:
            return JobTayariHarnessState(**{
                **state,
                "route": "terminal_failure",
                "error_trace": "NoCode: code_to_execute is empty",
            })

        result = execute_sandbox_code(code, state)
        new_stdout_history = list(state["stdout_history"]) + [result["stdout"]]

        return JobTayariHarnessState(**{
            **state,
            "execution_result": result,
            "stdout_history": new_stdout_history,
            "route": "validate" if result["success"] else "repair",
        })

    def _node_validate_output(self, state: JobTayariHarnessState) -> JobTayariHarnessState:
        """Validation node: run hard_validation_gate() against execution result."""
        exec_result = state.get("execution_result")
        if not exec_result or not exec_result.get("success"):
            # Execution failed — pass None to gate to record the failure
            return hard_validation_gate(state, llm_output=None)

        # Try to parse return_value as the structured output
        return_value = exec_result.get("return_value")
        if return_value:
            try:
                import ast as _ast
                parsed = _ast.literal_eval(return_value)
                return hard_validation_gate(state, llm_output=parsed)
            except (ValueError, SyntaxError):
                pass

        # Fall back to stdout parsing
        stdout = exec_result.get("stdout", "")
        if stdout.strip():
            try:
                import json as _json
                parsed = _json.loads(stdout)
                return hard_validation_gate(state, llm_output=parsed)
            except (ValueError, _json.JSONDecodeError):
                pass

        # No parseable output
        return hard_validation_gate(state, llm_output=None)

    async def _node_repair_code(self, state: JobTayariHarnessState) -> JobTayariHarnessState:
        """LLM repair node: generate repaired code given the error trace."""
        try:
            raw_output = await self._llm.generate_repair(state)
            validated = CodeRepairOutput.model_validate(raw_output)
            return JobTayariHarnessState(**{
                **state,
                "code_to_execute": validated.repaired_code,
                "llm_raw_output": str(raw_output),
                "dspy_signature_class": "CodeRepairOutput",
                "route": "execute",
            })
        except Exception as exc:  # noqa: BLE001
            return JobTayariHarnessState(**{
                **state,
                "error_trace": f"RepairGenError: {exc}",
                "route": "terminal_failure",
            })

    def _node_complete(self, state: JobTayariHarnessState) -> JobTayariHarnessState:
        """Terminal success node."""
        return JobTayariHarnessState(**{**state, "route": "complete"})

    def _node_terminal_failure(self, state: JobTayariHarnessState) -> JobTayariHarnessState:
        """Terminal failure node — DGM hard stop after max_iterations."""
        logger.warning(
            "Harness terminal failure for user=%s run=%s after %d iterations. Error: %s",
            state["user_id"], state["run_id"],
            state["syntax_errors_encountered"],
            state.get("error_trace", "unknown"),
        )
        return JobTayariHarnessState(**{**state, "route": "terminal_failure"})
