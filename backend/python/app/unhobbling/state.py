"""
JobTayari Harness State Schema — Milestone 1.

Implements Recursive Variable Virtualization from RLM (arXiv:2512.24601):
- Heavy text bodies (resume, JD, syllabus) stored as State strings NEVER injected
  into LLM context windows directly.
- LLM receives only symbolic handles (dict keys, token counts, section headings).
- All text manipulation (slicing, searching, token-counting) runs programmatically
  in isolated Python loops over these State variables.

DGM lineage (arXiv:2505.22954):
- Every code mutation, validation result, and repair attempt is recorded in lineage[]
- Failure counter enforces the hard 3-attempt termination gate.

qm multi-tenant (yc-software/qm):
- user_id + run_id guarantee per-user isolation across concurrent users.
"""
from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any, Dict, List, Literal, Optional, TypedDict


class VariableHandleMeta(TypedDict):
    """Metadata handle exposed to the LLM — NO raw text, only descriptors."""
    key: str                      # Dict key into context_variables
    byte_length: int              # Raw byte size of stored text
    char_length: int              # Character count
    estimated_tokens: int         # Approx token count (chars / 4)
    sha256: str                   # Content hash for cache/deduplication
    line_count: int               # Number of lines
    section_headings: List[str]   # Detected section headers (EXPERIENCE, SKILLS, etc.)
    document_kind: str            # 'resume' | 'jd' | 'syllabus' | 'generic'


class ExecutionResultDict(TypedDict):
    """Output contract of the sandboxed REPL gate."""
    success: bool
    stdout: str
    stderr: str
    return_value: Optional[str]   # repr() of the last expression value if any
    error: Optional[str]
    duration_ms: float
    code_hash: str                # SHA-256 of the executed code string


class LineageEntry(TypedDict):
    """DGM audit trail entry (arXiv:2505.22954 §3 — open-ended archive)."""
    attempt: int                          # 1-indexed attempt number
    timestamp_utc: float                  # Unix timestamp
    code_hash: str                        # SHA-256 of code_to_execute
    code_snippet: str                     # First 500 chars of generated code
    validation_error: Optional[str]       # Pydantic ValidationError message if any
    execution_error: Optional[str]        # REPL stderr if any
    stdout_trace: str                     # Full stdout for outer-loop optimizer
    pydantic_schema: str                  # Schema class name that was validated
    passed: bool                          # Whether this attempt passed
    repair_rationale: Optional[str]       # Explanation from CodeRepairOutput


class JobTayariHarnessState(TypedDict):
    """
    Immutable LangGraph-compatible state dictionary for the JobTayari harness.

    CRITICAL RULE (RLM §2): The LLM node NEVER receives context_variables values
    directly in its prompt. It receives variable_handles metadata only.
    All text operations run in the REPL sandbox via execute_sandbox_code().
    """
    # ── RLM Variable Store (arXiv:2512.24601) ────────────────────────────────
    context_variables: Dict[str, str]         # Heavy text bodies: {handle_key: raw_text}
    variable_handles: Dict[str, VariableHandleMeta]  # LLM-visible metadata only

    # ── Task Context ─────────────────────────────────────────────────────────
    task_type: str           # 'skill_extraction' | 'assessment_gen' | 'code_action' | 'code_repair'
    target_role: str         # Job title or learning objective
    dspy_signature_class: str  # DSPy signature name that governs current LLM node

    # ── CodeAct Execution (RLM §3 — REPL interface) ──────────────────────────
    code_to_execute: Optional[str]            # Python code to run in sandbox
    execution_result: Optional[ExecutionResultDict]  # Output of last REPL execution

    # ── DSPy Structured Output (arXiv:2310.03714) ────────────────────────────
    pydantic_output: Optional[Dict[str, Any]]  # Validated Pydantic model as dict
    llm_raw_output: Optional[str]             # LLM response BEFORE validation

    # ── DGM Hard Gate (arXiv:2505.22954 §4) ──────────────────────────────────
    syntax_errors_encountered: int            # Failure counter; hard-stop at max_iterations
    current_iteration: int                    # Current repair iteration (1-indexed)
    max_iterations: int                       # Hard ceiling — default 3, NEVER exceed
    validation_passed: bool                   # True only when Pydantic gate passes
    validation_error_message: Optional[str]   # Last Pydantic ValidationError detail
    error_trace: Optional[str]               # Full stderr/traceback for lineage

    # ── Deterministic Control Signal ─────────────────────────────────────────
    # The LLM has ZERO permission to write this field. Only router.py writes it.
    route: Literal["execute", "validate", "repair", "log", "complete", "terminal_failure"]

    # ── DGM Lineage Archive (arXiv:2505.22954 §3) ────────────────────────────
    lineage: List[LineageEntry]  # All attempts, mutations, outcomes — never truncated

    # ── Meta-Harness Logging (arXiv:2603.28052) ──────────────────────────────
    stdout_history: List[str]    # All REPL stdout outputs across attempts
    run_start_utc: float         # Unix timestamp of graph entry

    # ── qm Multi-Tenant Isolation (yc-software/qm) ───────────────────────────
    user_id: str     # Owner user ID — all filesystem paths scoped to this
    run_id: str      # Unique run UUID — log file key
    session_id: Optional[str]  # Optional session grouping across runs


_RESUME_SECTION_RE_PATTERNS = [
    "SUMMARY", "OBJECTIVE", "PROFILE", "EXPERIENCE", "EMPLOYMENT",
    "WORK HISTORY", "EDUCATION", "SKILLS", "TECHNICAL SKILLS",
    "PROJECTS", "CERTIFICATIONS", "AWARDS", "PUBLICATIONS",
    "LANGUAGES", "INTERESTS", "ACTIVITIES", "REFERENCES",
]


def _extract_section_headings(text: str) -> List[str]:
    """Detect section headings in a document for the variable handle metadata."""
    found = []
    upper = text.upper()
    for heading in _RESUME_SECTION_RE_PATTERNS:
        if heading in upper:
            found.append(heading)
    return found


def _detect_kind(key: str) -> str:
    """Infer document kind from variable key name."""
    k = key.lower()
    if "resume" in k or "cv" in k:
        return "resume"
    if "jd" in k or "job" in k or "description" in k:
        return "jd"
    if "syllabus" in k or "course" in k or "curriculum" in k:
        return "syllabus"
    return "generic"


def make_variable_handle(key: str, text: str) -> VariableHandleMeta:
    """
    Build a VariableHandleMeta for a given key/text pair.
    This is what gets passed to the LLM — NOT the raw text.
    """
    encoded = text.encode("utf-8")
    return VariableHandleMeta(
        key=key,
        byte_length=len(encoded),
        char_length=len(text),
        estimated_tokens=max(1, len(text) // 4),
        sha256=hashlib.sha256(encoded).hexdigest(),
        line_count=text.count("\n") + 1,
        section_headings=_extract_section_headings(text),
        document_kind=_detect_kind(key),
    )


def new_state(
    user_id: str,
    task_type: str = "skill_extraction",
    target_role: str = "",
    max_iterations: int = 3,
    session_id: Optional[str] = None,
) -> JobTayariHarnessState:
    """Construct a fresh, valid harness state. Always use this factory."""
    return JobTayariHarnessState(
        context_variables={},
        variable_handles={},
        task_type=task_type,
        target_role=target_role,
        dspy_signature_class="SkillExtractionOutput",
        code_to_execute=None,
        execution_result=None,
        pydantic_output=None,
        llm_raw_output=None,
        syntax_errors_encountered=0,
        current_iteration=0,
        max_iterations=max(1, min(max_iterations, 3)),  # Hard ceiling: never > 3
        validation_passed=False,
        validation_error_message=None,
        error_trace=None,
        route="execute",
        lineage=[],
        stdout_history=[],
        run_start_utc=time.time(),
        user_id=user_id,
        run_id=str(uuid.uuid4()),
        session_id=session_id,
    )


def add_context_variable(
    state: JobTayariHarnessState,
    key: str,
    text: str,
) -> JobTayariHarnessState:
    """
    Store a heavy text body in state and build its variable handle.
    Returns a new state dict (immutable update pattern for LangGraph).
    """
    new_vars = dict(state["context_variables"])
    new_vars[key] = text
    new_handles = dict(state["variable_handles"])
    new_handles[key] = make_variable_handle(key, text)
    return JobTayariHarnessState(**{**state, "context_variables": new_vars, "variable_handles": new_handles})
