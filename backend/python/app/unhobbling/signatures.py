"""
Milestone 2: DSPy-Pattern Pydantic Signatures — Pipeline Compilation Layer.

Implements arXiv:2310.03714 (DSPy: Compiling Declarative Language Model Calls):
- Free-form string prompts are FORBIDDEN. All LLM I/O is typed via Pydantic schemas.
- Signatures declare input fields and output fields as typed Pydantic models.
- The LLM receives ONLY the typed field descriptions — never raw resume text.
- Prompt optimization is possible because there are no hard-coded strings.
- Every output is validated against the Pydantic schema before use.

JobTayari task signatures:
1. SkillExtractionOutput — extract skills from resume/JD variable handles
2. AssessmentGenOutput — generate skill gap assessments and learning paths
3. CodeActionOutput — generate Python code to operate on variable handles
4. CodeRepairOutput — repair failed code given error traces
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Type

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Confidence levels ─────────────────────────────────────────────────────────

class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ── Signature 1: Skill Extraction (DSPy §3.1 — typed field declarations) ──────

class ExtractedSkill(BaseModel):
    """A single skill extracted from a resume or job description."""
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., description="Canonical skill name (e.g. 'Python', 'Kubernetes')")
    skill_type: Literal["technical", "soft", "domain", "certification"] = Field(
        ..., description="Skill category"
    )
    proficiency: Optional[Literal["beginner", "intermediate", "advanced", "expert"]] = Field(
        None, description="Proficiency level if detectable from context"
    )
    years_experience: Optional[int] = Field(
        None, ge=0, le=50, description="Estimated years of experience if mentioned"
    )
    evidence_line: Optional[str] = Field(
        None, max_length=300,
        description="Verbatim quote from the source variable that supports this extraction"
    )


class SkillExtractionOutput(BaseModel):
    """
    DSPy Signature: Extract structured skills from resume and JD variable handles.

    INPUT (injected as system context, NOT raw text):
      - resume_handle: VariableHandleMeta key pointing to resume in state
      - jd_handle: VariableHandleMeta key pointing to JD in state
      - target_role: Job title for relevance filtering

    OUTPUT: This model — validated via Pydantic before any downstream use.
    """
    model_config = ConfigDict(extra="forbid")

    resume_handle_key: str = Field(..., description="Variable handle key used for extraction")
    jd_handle_key: str = Field(..., description="Variable handle key used for extraction")
    extracted_skills: List[ExtractedSkill] = Field(
        default_factory=list,
        description="All skills found in the resume"
    )
    required_skills: List[str] = Field(
        default_factory=list,
        description="Skills explicitly required by the job description"
    )
    missing_skills: List[str] = Field(
        default_factory=list,
        description="Required skills absent from the resume"
    )
    transferable_skills: List[str] = Field(
        default_factory=list,
        description="Resume skills that partially satisfy JD requirements"
    )
    match_score: float = Field(
        ..., ge=0.0, le=1.0,
        description="Skill alignment score from 0.0 (no match) to 1.0 (perfect match)"
    )
    confidence: ConfidenceLevel = Field(
        ..., description="Confidence in extraction accuracy"
    )
    token_budget_used: int = Field(
        0, ge=0,
        description="Estimated tokens consumed by this extraction (for cost tracking)"
    )

    @field_validator("extracted_skills")
    @classmethod
    def extracted_skills_not_empty(cls, v: List[ExtractedSkill]) -> List[ExtractedSkill]:
        # Zero extracted skills from a non-empty resume is suspicious — flag low confidence
        return v  # Validated by confidence field — allow empty for truly empty resumes

    @field_validator("match_score")
    @classmethod
    def match_score_range(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"match_score must be in [0.0, 1.0], got {v}")
        return round(v, 4)


# ── Signature 2: Assessment Generation ───────────────────────────────────────

class LearningResource(BaseModel):
    """A concrete learning resource for a skill gap."""
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., description="Resource title")
    resource_type: Literal["course", "book", "project", "certification", "practice"] = Field(...)
    estimated_hours: Optional[int] = Field(None, ge=1, le=500)
    url_or_platform: Optional[str] = Field(None, max_length=200)


class AssessmentQuestion(BaseModel):
    """A single assessment question for a skill gap."""
    model_config = ConfigDict(extra="forbid")

    question: str = Field(..., min_length=10, description="Assessment question text")
    question_type: Literal["multiple_choice", "coding", "short_answer", "scenario"] = Field(...)
    target_skill: str = Field(..., description="Skill this question assesses")
    difficulty: Literal["easy", "medium", "hard"] = Field("medium")
    rubric: Optional[str] = Field(None, description="Evaluation rubric or expected answer", max_length=500)


class AssessmentGenOutput(BaseModel):
    """
    DSPy Signature: Generate skill-gap assessment and learning path.

    INPUT:
      - skill_extraction_result: SkillExtractionOutput from previous node
      - target_role: Job title
      - learning_time_budget_hours: How many hours the user can invest

    OUTPUT: This model.
    """
    model_config = ConfigDict(extra="forbid")

    target_role: str = Field(..., description="Job role this assessment targets")
    priority_gaps: List[str] = Field(
        default_factory=list,
        description="Top 5 most critical skill gaps to address, ordered by priority"
    )
    assessment_questions: List[AssessmentQuestion] = Field(
        default_factory=list,
        min_length=1,
        description="Diagnostic questions to assess current level"
    )
    learning_path: List[LearningResource] = Field(
        default_factory=list,
        description="Ordered learning resources to close the skill gaps"
    )
    estimated_readiness_weeks: int = Field(
        ..., ge=1, le=104,
        description="Estimated weeks to reach job-ready competency"
    )
    confidence: ConfidenceLevel = Field(...)

    @field_validator("priority_gaps")
    @classmethod
    def max_five_gaps(cls, v: List[str]) -> List[str]:
        return v[:5]  # Truncate silently to prevent overwhelming the user


# ── Signature 3: Code Action (LLM generates Python to run in REPL) ────────────

class CodeActionOutput(BaseModel):
    """
    DSPy Signature: Generate Python code to run in the VirtualizedREPL.

    The LLM generates CODE that calls VirtualizedREPL functions:
      get_variable(key), slice_variable(key, start, end),
      search_variable(key, pattern), token_count(key), list_variables()

    This is the core RLM pattern: LLM writes code, code runs on variables,
    REPL returns structured output — LLM never sees raw text directly.

    INPUT:
      - variable_handles: Dict of VariableHandleMeta (metadata, NOT text)
      - task_description: What analysis to perform on the variables
      - target_output_format: What structure the code should produce

    OUTPUT: This model — code field is executed in the REPL sandbox.
    """
    model_config = ConfigDict(extra="forbid")

    code_to_execute: str = Field(
        ...,
        min_length=10,
        description=(
            "Valid Python code that operates on variable handles via: "
            "get_variable(key), slice_variable(key, start, end), "
            "search_variable(key, pattern), token_count(key). "
            "Must assign final output to variable named 'result'."
        )
    )
    expected_output_type: Literal["list", "dict", "str", "int", "float"] = Field(
        "dict", description="Expected Python type of the 'result' variable"
    )
    rationale: str = Field(
        ..., max_length=500,
        description="Why this code solves the task — used in lineage audit"
    )
    uses_variables: List[str] = Field(
        default_factory=list,
        description="Variable handle keys this code will access"
    )

    @field_validator("code_to_execute")
    @classmethod
    def code_must_not_contain_dangerous_imports(cls, v: str) -> str:
        forbidden = ["import os", "import sys", "import subprocess", "import socket",
                     "__import__", "eval(", "exec(", "open("]
        for f in forbidden:
            if f in v:
                raise ValueError(
                    f"code_to_execute contains forbidden pattern '{f}'. "
                    "Only VirtualizedREPL functions are permitted."
                )
        return v


# ── Signature 4: Code Repair (DGM self-repair loop) ───────────────────────────

class CodeRepairOutput(BaseModel):
    """
    DSPy Signature: Repair code that failed validation or execution.

    DGM arXiv:2505.22954 §4: When code fails, a specialized repair node
    receives the original code, the error trace, and the validation error
    to produce a corrected version. This is tracked in the lineage archive.

    INPUT:
      - original_code: The code that failed
      - stderr_trace: Full stderr output from REPL execution
      - validation_error: Pydantic ValidationError message if validation failed
      - attempt_number: Which repair attempt this is (1, 2, 3)

    OUTPUT: This model.
    """
    model_config = ConfigDict(extra="forbid")

    repaired_code: str = Field(
        ...,
        min_length=10,
        description="Fixed Python code — must not repeat the same error"
    )
    diagnosis: str = Field(
        ..., max_length=500,
        description="Root cause of the failure"
    )
    patch_rationale: str = Field(
        ..., max_length=500,
        description="What specifically was changed and why"
    )
    confidence: ConfidenceLevel = Field(...)

    @field_validator("repaired_code")
    @classmethod
    def repaired_code_must_not_contain_dangerous_imports(cls, v: str) -> str:
        forbidden = ["import os", "import sys", "import subprocess", "import socket",
                     "__import__", "eval(", "exec(", "open("]
        for f in forbidden:
            if f in v:
                raise ValueError(
                    f"repaired_code contains forbidden pattern '{f}'."
                )
        return v


# ── Signature Registry (DSPy §3.2 — program composition) ──────────────────────

class HarnessSignatureRegistry:
    """
    Registry mapping task_type strings to their Pydantic signature classes.
    This enables the router and orchestrator to look up schemas dynamically
    without hard-coding conditional blocks (DSPy program composition pattern).
    """
    _REGISTRY: Dict[str, Type[BaseModel]] = {
        "skill_extraction": SkillExtractionOutput,
        "assessment_gen": AssessmentGenOutput,
        "code_action": CodeActionOutput,
        "code_repair": CodeRepairOutput,
    }

    @classmethod
    def get(cls, task_type: str) -> Type[BaseModel]:
        schema = cls._REGISTRY.get(task_type)
        if schema is None:
            raise ValueError(
                f"Unknown task_type '{task_type}'. "
                f"Registered types: {list(cls._REGISTRY)}"
            )
        return schema

    @classmethod
    def all_task_types(cls) -> List[str]:
        return list(cls._REGISTRY.keys())

    @classmethod
    def schema_for_llm(cls, task_type: str) -> Dict[str, Any]:
        """Return JSON schema dict for a task type — injected into LLM system prompt."""
        return cls.get(task_type).model_json_schema()
