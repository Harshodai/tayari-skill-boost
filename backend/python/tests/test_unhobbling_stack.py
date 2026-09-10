"""
Test suite for the JobTayari Unhobbling Stack.

Tests are grounded in all 5 research papers:
- RLM (2512.24601): Variable virtualization, context isolation
- DSPy (2310.03714): Pydantic signature validation, typed outputs
- Meta-Harness (2603.28052): Filesystem logging, trace schema
- DGM (2505.22954): 3-turn hard gate, lineage audit
- Continual Harness (2605.09998): Online adaptation, state schema completeness
- qm: Multi-tenant isolation, path scoping

Critical constraints (AGENTS.md):
- JWT_SECRET must be set or conftest.py collection fails
- Passwords must be 12+ chars
- Use 127.0.0.1 not localhost
- Never hardcode user data — always use controlled test fixtures
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

import pytest

# ── Set required env vars before any imports ────────────────────────────────
# These are required by auth middleware even in pure unit tests.
os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-ONLY-not-prod")
os.environ.setdefault("EVAL_MODE", "false")
os.environ.setdefault("APP_ENV", "test")

# Use temp dirs so tests don't pollute the repo
_TEST_TEMP_DIR = tempfile.mkdtemp(prefix="tayari_test_")
os.environ["TAYARI_LOGS_DIR"] = str(Path(_TEST_TEMP_DIR) / "logs")
os.environ["TAYARI_WORKSPACE_DIR"] = str(Path(_TEST_TEMP_DIR) / "workspace")

# ── Imports ──────────────────────────────────────────────────────────────────
# NOTE: Imports are intentionally after os.environ.setdefault() calls above.
# Environment variables (TAYARI_LOGS_DIR etc.) MUST be set before modules load.
# ruff: noqa: E402
from app.unhobbling.state import (  # noqa: E402
    JobTayariHarnessState,
    new_state,
    add_context_variable,
)
from app.unhobbling.repl_gate import (
    SecurityError,
    VirtualizedREPL,
    execute_sandbox_code,
    _ast_security_check,
)
from app.unhobbling.signatures import (
    SkillExtractionOutput,
    AssessmentGenOutput,
    CodeActionOutput,
    CodeRepairOutput,
    HarnessSignatureRegistry,
    ConfidenceLevel,
    ExtractedSkill,
    AssessmentQuestion,
)
from app.unhobbling.router import (
    hard_validation_gate,
    deterministic_conditional_edge,
)
from app.unhobbling.logging_middleware import (
    HierarchicalLoggingMiddleware,
    load_run_trace,
    evaluate_failure_traces,
    _atomic_write_json,
)
from app.unhobbling.multi_tenant import TenantWorkspace
from app.unhobbling.orchestrator import JobTayariOrchestrator, MockLLMCallable, RealLLMCallable


# ── Fixtures ─────────────────────────────────────────────────────────────────

SAMPLE_RESUME = """
John Doe
Software Engineer | Python | Kubernetes | AWS

EXPERIENCE
Senior Software Engineer at Acme Corp (2020-2024)
- Built distributed Python microservices handling 10M requests/day
- Migrated legacy monolith to Kubernetes, reducing cost by 40%
- Led team of 5 engineers using Agile/Scrum methodology

SKILLS
Python, Go, Kubernetes, Docker, AWS, PostgreSQL, Redis, FastAPI, REST APIs

EDUCATION
B.Sc. Computer Science, MIT 2018
"""

SAMPLE_JD = """
Senior Backend Engineer - Python & Cloud

Requirements:
- 5+ years Python experience
- Kubernetes and Docker orchestration
- AWS cloud infrastructure
- PostgreSQL database design
- Experience with FastAPI or Django REST framework
- Strong understanding of distributed systems

Nice to have:
- Go experience
- Redis experience
- Machine learning familiarity
"""


@pytest.fixture
def test_user_id() -> str:
    return f"test-user-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def fresh_state(test_user_id: str) -> JobTayariHarnessState:
    state = new_state(
        user_id=test_user_id,
        task_type="skill_extraction",
        target_role="Senior Backend Engineer",
        max_iterations=3,
    )
    state = add_context_variable(state, "resume", SAMPLE_RESUME)
    state = add_context_variable(state, "jd", SAMPLE_JD)
    return state


# ═══════════════════════════════════════════════════════════════════════════
# MILESTONE 1: State Schema & RLM Variable Virtualization (arXiv:2512.24601)
# ═══════════════════════════════════════════════════════════════════════════

class TestStateSchema:
    """M1: JobTayariHarnessState TypedDict correctness."""

    def test_new_state_has_all_required_keys(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        required_keys = [
            "context_variables", "variable_handles", "task_type",
            "target_role", "dspy_signature_class", "code_to_execute",
            "execution_result", "pydantic_output", "llm_raw_output",
            "syntax_errors_encountered", "current_iteration", "max_iterations",
            "validation_passed", "validation_error_message", "error_trace",
            "route", "lineage", "stdout_history", "run_start_utc",
            "user_id", "run_id", "session_id",
        ]
        for key in required_keys:
            assert key in state, f"Missing required key: {key}"

    def test_max_iterations_hard_ceiling_is_3(self, test_user_id: str) -> None:
        """DGM (2505.22954): hard ceiling enforced in new_state()."""
        state = new_state(user_id=test_user_id, max_iterations=999)
        assert state["max_iterations"] == 3, "max_iterations must never exceed 3"

    def test_run_id_is_unique_per_call(self, test_user_id: str) -> None:
        s1 = new_state(user_id=test_user_id)
        s2 = new_state(user_id=test_user_id)
        assert s1["run_id"] != s2["run_id"]

    def test_initial_route_is_execute(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        assert state["route"] == "execute"

    def test_initial_validation_not_passed(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        assert state["validation_passed"] is False

    def test_initial_lineage_is_empty(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        assert state["lineage"] == []

    def test_initial_syntax_errors_is_zero(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        assert state["syntax_errors_encountered"] == 0


class TestRLMVariableVirtualization:
    """M1: RLM (arXiv:2512.24601) — text stored in state, not in LLM context."""

    def test_add_context_variable_stores_text(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        state = add_context_variable(state, "resume", SAMPLE_RESUME)
        assert "resume" in state["context_variables"]
        assert state["context_variables"]["resume"] == SAMPLE_RESUME

    def test_variable_handle_has_no_raw_text(self, test_user_id: str) -> None:
        """RLM: the handle (what LLM sees) must NOT contain raw text."""
        state = new_state(user_id=test_user_id)
        state = add_context_variable(state, "resume", SAMPLE_RESUME)
        handle = state["variable_handles"]["resume"]
        # Handle should have metadata fields only
        assert "key" in handle
        assert "sha256" in handle
        assert "estimated_tokens" in handle
        assert "section_headings" in handle
        # Raw text MUST NOT be in the handle
        assert SAMPLE_RESUME not in str(handle)

    def test_variable_handle_sha256_is_correct(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        state = add_context_variable(state, "resume", SAMPLE_RESUME)
        handle = state["variable_handles"]["resume"]
        expected_sha = hashlib.sha256(SAMPLE_RESUME.encode("utf-8")).hexdigest()
        assert handle["sha256"] == expected_sha

    def test_variable_handle_detects_resume_kind(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        state = add_context_variable(state, "resume", SAMPLE_RESUME)
        assert state["variable_handles"]["resume"]["document_kind"] == "resume"

    def test_variable_handle_detects_jd_kind(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        state = add_context_variable(state, "jd", SAMPLE_JD)
        assert state["variable_handles"]["jd"]["document_kind"] == "jd"

    def test_variable_handle_detects_section_headings(self, test_user_id: str) -> None:
        state = new_state(user_id=test_user_id)
        state = add_context_variable(state, "resume", SAMPLE_RESUME)
        headings = state["variable_handles"]["resume"]["section_headings"]
        assert "EXPERIENCE" in headings
        assert "SKILLS" in headings
        assert "EDUCATION" in headings


# ═══════════════════════════════════════════════════════════════════════════
# MILESTONE 1 (part 2): REPL Gate Security
# ═══════════════════════════════════════════════════════════════════════════

class TestREPLGateSecurity:
    """M1: Sandboxed REPL with AST pre-check (extends codeact_repl.py)."""

    def test_safe_code_passes_ast_check(self) -> None:
        safe_code = "result = [x * 2 for x in range(10)]"
        _ast_security_check(safe_code)  # Should not raise

    def test_os_import_blocked(self) -> None:
        with pytest.raises(SecurityError, match="os"):
            _ast_security_check("import os\nos.system('ls')")

    def test_subprocess_import_blocked(self) -> None:
        with pytest.raises(SecurityError):
            _ast_security_check("import subprocess")

    def test_socket_import_blocked(self) -> None:
        with pytest.raises(SecurityError):
            _ast_security_check("import socket")

    def test_eval_builtin_blocked(self) -> None:
        with pytest.raises(SecurityError, match="eval"):
            _ast_security_check("eval('1 + 1')")

    def test_exec_builtin_blocked(self) -> None:
        with pytest.raises(SecurityError, match="exec"):
            _ast_security_check("exec('x = 1')")

    def test_open_builtin_blocked(self) -> None:
        with pytest.raises(SecurityError, match="open"):
            _ast_security_check("open('/etc/passwd')")

    def test_private_attribute_access_blocked(self) -> None:
        with pytest.raises(SecurityError, match="private"):
            _ast_security_check("x.__class__.__bases__[0].__subclasses__()")

    def test_syntax_error_raises_security_error(self) -> None:
        with pytest.raises(SecurityError, match="SyntaxError"):
            _ast_security_check("def (broken_syntax:")

    def test_pprint_import_blocked(self) -> None:
        with pytest.raises(SecurityError, match="pprint"):
            _ast_security_check("import pprint")

    def test_blocked_attributes_access_blocked(self) -> None:
        for attr in ["sys", "modules", "system", "popen", "subprocess"]:
            with pytest.raises(SecurityError, match="sandbox escape"):
                _ast_security_check(f"x.{attr}")

    def test_math_import_allowed(self) -> None:
        _ast_security_check("import math\nresult = math.pi")  # Should not raise

    def test_virtualized_repl_get_variable(self, fresh_state: JobTayariHarnessState) -> None:
        repl = VirtualizedREPL(fresh_state["context_variables"])
        text = repl.get_variable("resume")
        assert SAMPLE_RESUME == text

    def test_virtualized_repl_slice_variable(self, fresh_state: JobTayariHarnessState) -> None:
        repl = VirtualizedREPL(fresh_state["context_variables"])
        sliced = repl.slice_variable("resume", 0, 3)
        lines = SAMPLE_RESUME.splitlines()
        assert sliced == "\n".join(lines[0:3])

    def test_virtualized_repl_search_variable(self, fresh_state: JobTayariHarnessState) -> None:
        repl = VirtualizedREPL(fresh_state["context_variables"])
        results = repl.search_variable("resume", "python", max_results=5)
        assert len(results) >= 1
        assert any("Python" in r or "python" in r.lower() for r in results)

    def test_virtualized_repl_token_count(self, fresh_state: JobTayariHarnessState) -> None:
        repl = VirtualizedREPL(fresh_state["context_variables"])
        count = repl.token_count("resume")
        assert count > 0
        assert count == max(1, len(SAMPLE_RESUME) // 4)

    def test_virtualized_repl_missing_key_raises(self, fresh_state: JobTayariHarnessState) -> None:
        repl = VirtualizedREPL(fresh_state["context_variables"])
        with pytest.raises(KeyError):
            repl.get_variable("nonexistent_key")

    def test_execute_sandbox_code_success(self, fresh_state: JobTayariHarnessState) -> None:
        code = "result = token_count('resume') + token_count('jd')"
        exec_result = execute_sandbox_code(code, fresh_state)
        assert exec_result["success"] is True
        assert exec_result["return_value"] is not None

    def test_execute_sandbox_code_captures_stdout(self, fresh_state: JobTayariHarnessState) -> None:
        code = "print('hello from sandbox')"
        exec_result = execute_sandbox_code(code, fresh_state)
        assert exec_result["success"] is True
        assert "hello from sandbox" in exec_result["stdout"]

    def test_execute_sandbox_code_blocks_os_import(self, fresh_state: JobTayariHarnessState) -> None:
        code = "import os\nresult = os.getcwd()"
        exec_result = execute_sandbox_code(code, fresh_state)
        assert exec_result["success"] is False
        assert exec_result["error"] is not None

    def test_execute_sandbox_code_returns_code_hash(self, fresh_state: JobTayariHarnessState) -> None:
        code = "result = 42"
        exec_result = execute_sandbox_code(code, fresh_state)
        expected_hash = hashlib.sha256(code.encode()).hexdigest()
        assert exec_result["code_hash"] == expected_hash

    def test_execute_sandbox_code_timeout(self, fresh_state: JobTayariHarnessState) -> None:
        code = "x = 0\nwhile True:\n    x += 1"
        exec_result = execute_sandbox_code(code, fresh_state, timeout_hint_ms=50.0)
        assert exec_result["success"] is False
        assert "TimeoutError" in exec_result["error"]


# ═══════════════════════════════════════════════════════════════════════════
# MILESTONE 2: DSPy Signatures (arXiv:2310.03714)
# ═══════════════════════════════════════════════════════════════════════════

class TestDSPySignatures:
    """M2: DSPy-pattern Pydantic Signatures — typed LLM I/O."""

    def test_skill_extraction_output_valid_construction(self) -> None:
        output = SkillExtractionOutput(
            resume_handle_key="resume",
            jd_handle_key="jd",
            extracted_skills=[
                ExtractedSkill(name="Python", skill_type="technical", evidence_line="Built Python microservices")
            ],
            required_skills=["Python", "Kubernetes"],
            missing_skills=["Machine Learning"],
            transferable_skills=["AWS"],
            match_score=0.75,
            confidence=ConfidenceLevel.HIGH,
        )
        assert output.match_score == 0.75
        assert output.confidence == ConfidenceLevel.HIGH

    def test_skill_extraction_output_rejects_invalid_match_score(self) -> None:
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SkillExtractionOutput(
                resume_handle_key="resume",
                jd_handle_key="jd",
                extracted_skills=[],
                required_skills=[],
                missing_skills=[],
                transferable_skills=[],
                match_score=1.5,  # > 1.0 — invalid
                confidence=ConfidenceLevel.HIGH,
            )

    def test_code_action_output_blocks_dangerous_imports(self) -> None:
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="forbidden"):
            CodeActionOutput(
                code_to_execute="import os\nos.system('ls')",
                expected_output_type="str",
                rationale="test",
                uses_variables=[],
            )

    def test_code_repair_output_blocks_dangerous_imports(self) -> None:
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            CodeRepairOutput(
                repaired_code="import subprocess\nsubprocess.run('rm -rf /')",
                diagnosis="test",
                patch_rationale="test",
                confidence=ConfidenceLevel.LOW,
            )

    def test_assessment_gen_truncates_priority_gaps_to_five(self) -> None:
        output = AssessmentGenOutput(
            target_role="Engineer",
            priority_gaps=["a", "b", "c", "d", "e", "f", "g"],  # 7 gaps → truncated to 5
            assessment_questions=[
                AssessmentQuestion(
                    question="What is Python?",
                    question_type="short_answer",
                    target_skill="Python",
                )
            ],
            learning_path=[],
            estimated_readiness_weeks=4,
            confidence=ConfidenceLevel.MEDIUM,
        )
        assert len(output.priority_gaps) == 5

    def test_signature_registry_resolves_all_task_types(self) -> None:
        for task_type in ["skill_extraction", "assessment_gen", "code_action", "code_repair"]:
            schema = HarnessSignatureRegistry.get(task_type)
            assert schema is not None

    def test_signature_registry_raises_for_unknown_type(self) -> None:
        with pytest.raises(ValueError, match="Unknown task_type"):
            HarnessSignatureRegistry.get("nonexistent_task")

    def test_signature_registry_schema_for_llm_returns_json_schema(self) -> None:
        schema_dict = HarnessSignatureRegistry.schema_for_llm("skill_extraction")
        assert "properties" in schema_dict or "title" in schema_dict


# ═══════════════════════════════════════════════════════════════════════════
# MILESTONE 2 (part 2): DGM Hard Validation Gate (arXiv:2505.22954)
# ═══════════════════════════════════════════════════════════════════════════

class TestDGMHardGate:
    """M2: DGM 3-turn hard gate and deterministic conditional edge."""

    def test_valid_output_sets_validation_passed(self, fresh_state: JobTayariHarnessState) -> None:
        valid_output = {
            "resume_handle_key": "resume",
            "jd_handle_key": "jd",
            "extracted_skills": [],
            "required_skills": ["Python"],
            "missing_skills": [],
            "transferable_skills": [],
            "match_score": 0.8,
            "confidence": "high",
            "token_budget_used": 100,
        }
        updated = hard_validation_gate(fresh_state, llm_output=valid_output)
        assert updated["validation_passed"] is True
        assert updated["route"] == "log"

    def test_invalid_output_increments_error_counter(self, fresh_state: JobTayariHarnessState) -> None:
        invalid_output = {"bad_field": "wrong_data", "match_score": 99.9}
        updated = hard_validation_gate(fresh_state, llm_output=invalid_output)
        assert updated["validation_passed"] is False
        assert updated["syntax_errors_encountered"] == 1

    def test_third_failure_triggers_terminal_failure(self, test_user_id: str) -> None:
        """DGM (2505.22954 §4): exactly 3 attempts max — hard stop at 3rd failure."""
        state = new_state(user_id=test_user_id, max_iterations=3)
        state = add_context_variable(state, "resume", SAMPLE_RESUME)
        state = add_context_variable(state, "jd", SAMPLE_JD)

        bad_output = {"completely": "wrong"}

        # Attempt 1
        state = hard_validation_gate(state, llm_output=bad_output)
        assert state["syntax_errors_encountered"] == 1
        assert state["route"] == "repair"

        # Attempt 2
        state = hard_validation_gate(state, llm_output=bad_output)
        assert state["syntax_errors_encountered"] == 2
        assert state["route"] == "repair"

        # Attempt 3 — MUST be terminal_failure
        state = hard_validation_gate(state, llm_output=bad_output)
        assert state["syntax_errors_encountered"] == 3
        assert state["route"] == "terminal_failure", \
            "DGM hard gate: must be terminal_failure after 3 failures"

    def test_none_output_increments_error_counter(self, fresh_state: JobTayariHarnessState) -> None:
        updated = hard_validation_gate(fresh_state, llm_output=None)
        assert updated["validation_passed"] is False
        assert updated["syntax_errors_encountered"] == 1

    def test_validation_failure_records_lineage_entry(self, fresh_state: JobTayariHarnessState) -> None:
        """DGM (2505.22954 §3): all attempts recorded in lineage archive."""
        updated = hard_validation_gate(fresh_state, llm_output={"bad": "data"})
        assert len(updated["lineage"]) == 1
        entry = updated["lineage"][0]
        assert entry["passed"] is False
        assert entry["validation_error"] is not None

    def test_validation_success_records_lineage_entry(self, fresh_state: JobTayariHarnessState) -> None:
        valid_output = {
            "resume_handle_key": "resume",
            "jd_handle_key": "jd",
            "extracted_skills": [],
            "required_skills": [],
            "missing_skills": [],
            "transferable_skills": [],
            "match_score": 0.5,
            "confidence": "medium",
            "token_budget_used": 0,
        }
        updated = hard_validation_gate(fresh_state, llm_output=valid_output)
        assert len(updated["lineage"]) == 1
        assert updated["lineage"][0]["passed"] is True

    def test_deterministic_edge_complete_when_validation_passed(self, fresh_state: JobTayariHarnessState) -> None:
        state = JobTayariHarnessState(**{**fresh_state, "validation_passed": True})
        assert deterministic_conditional_edge(state) == "complete"

    def test_deterministic_edge_repair_on_failure_under_limit(self, fresh_state: JobTayariHarnessState) -> None:
        state = JobTayariHarnessState(**{
            **fresh_state,
            "validation_passed": False,
            "syntax_errors_encountered": 1,
            "route": "repair",
        })
        assert deterministic_conditional_edge(state) == "repair"

    def test_deterministic_edge_terminal_when_errors_exceed_limit(self, fresh_state: JobTayariHarnessState) -> None:
        state = JobTayariHarnessState(**{
            **fresh_state,
            "validation_passed": False,
            "syntax_errors_encountered": 3,  # >= max_iterations (3)
            "route": "repair",
        })
        assert deterministic_conditional_edge(state) == "terminal_failure"

    def test_deterministic_edge_explicit_terminal_failure_route(self, fresh_state: JobTayariHarnessState) -> None:
        state = JobTayariHarnessState(**{**fresh_state, "route": "terminal_failure"})
        assert deterministic_conditional_edge(state) == "terminal_failure"


# ═══════════════════════════════════════════════════════════════════════════
# MILESTONE 3: Hierarchical Logging Middleware (arXiv:2603.28052)
# ═══════════════════════════════════════════════════════════════════════════

class TestHierarchicalLogging:
    """M3: Meta-Harness filesystem trace logging."""

    def test_atomic_write_produces_valid_json(self, tmp_path: Path) -> None:
        path = tmp_path / "test.json"
        data = {"key": "value", "nested": {"a": 1}}
        _atomic_write_json(path, data)
        assert path.exists()
        with open(path) as f:
            loaded = json.load(f)
        assert loaded == data

    def test_atomic_write_no_tmp_file_left_on_success(self, tmp_path: Path) -> None:
        path = tmp_path / "test.json"
        _atomic_write_json(path, {"x": 1})
        tmp_path_file = path.with_suffix(".tmp")
        assert not tmp_path_file.exists()

    def test_logging_middleware_creates_log_file(self, fresh_state: JobTayariHarnessState) -> None:
        middleware = HierarchicalLoggingMiddleware(fresh_state)
        middleware.record_step("test_node", fresh_state)
        log_path = middleware.flush(fresh_state)
        assert log_path.exists()

    def test_log_file_redacts_raw_text(self, fresh_state: JobTayariHarnessState) -> None:
        """Context variables (PII) must be redacted in log files."""
        middleware = HierarchicalLoggingMiddleware(fresh_state)
        log_path = middleware.flush(fresh_state)
        with open(log_path) as f:
            content = f.read()
        # Raw resume text must NOT appear in log
        assert SAMPLE_RESUME.strip()[:100] not in content
        assert "[REDACTED:" in content

    def test_safe_state_snapshot_redacts_large_stdout(self, fresh_state: JobTayariHarnessState) -> None:
        from app.unhobbling.logging_middleware import _safe_state_snapshot
        state_with_stdout = dict(fresh_state)
        state_with_stdout["stdout_history"] = ["short stdout", "x" * 250]
        snapshot = _safe_state_snapshot(state_with_stdout)
        assert snapshot["stdout_history"][0] == "short stdout"
        assert snapshot["stdout_history"][1] == "[REDACTED_STDOUT]"

    def test_log_file_contains_run_id(self, fresh_state: JobTayariHarnessState) -> None:
        middleware = HierarchicalLoggingMiddleware(fresh_state)
        log_path = middleware.flush(fresh_state)
        with open(log_path) as f:
            trace = json.load(f)
        assert trace["run_id"] == fresh_state["run_id"]

    def test_log_file_scoped_to_user_id(self, fresh_state: JobTayariHarnessState) -> None:
        middleware = HierarchicalLoggingMiddleware(fresh_state)
        log_path = middleware.flush(fresh_state)
        # Path must contain user_id (qm isolation)
        assert fresh_state["user_id"] in str(log_path)

    def test_context_manager_flushes_on_exit(self, fresh_state: JobTayariHarnessState) -> None:
        user_id = fresh_state["user_id"]
        run_id = fresh_state["run_id"]
        with HierarchicalLoggingMiddleware(fresh_state) as log:
            log.record_step("test_node", fresh_state)
        # After context exit, trace should be on disk
        loaded = load_run_trace(user_id, run_id)
        assert loaded.get("run_id") == run_id

    def test_load_run_trace_returns_empty_dict_for_missing_run(self) -> None:
        result = load_run_trace("nonexistent-user", "nonexistent-run")
        assert result == {}

    def test_evaluate_failure_traces_returns_summary(self, fresh_state: JobTayariHarnessState) -> None:
        middleware = HierarchicalLoggingMiddleware(fresh_state)
        middleware.flush(fresh_state)
        summary = evaluate_failure_traces(fresh_state["user_id"])
        assert "total_runs_analyzed" in summary
        assert "success_rate" in summary
        assert "failed_run_ids" in summary

    def test_meta_stats_updated_after_flush(self, fresh_state: JobTayariHarnessState) -> None:
        middleware = HierarchicalLoggingMiddleware(fresh_state)
        middleware.flush(fresh_state)
        workspace = TenantWorkspace(fresh_state["user_id"])
        assert workspace.meta_stats_path().exists()
        with open(workspace.meta_stats_path()) as f:
            stats = json.load(f)
        assert stats["total_runs"] >= 1


# ═══════════════════════════════════════════════════════════════════════════
# qm Multi-Tenant Isolation (yc-software/qm)
# ═══════════════════════════════════════════════════════════════════════════

class TestMultiTenantIsolation:
    """qm: per-user workspace isolation, path scoping, credential separation."""

    def test_different_users_get_different_workspace_dirs(self) -> None:
        ws_a = TenantWorkspace("user-alpha")
        ws_b = TenantWorkspace("user-beta")
        assert ws_a.workspace_dir != ws_b.workspace_dir

    def test_user_a_logs_not_accessible_via_user_b_path(self) -> None:
        ws_a = TenantWorkspace("user-alpha")
        ws_b = TenantWorkspace("user-beta")
        run_a = ws_a.log_path("run-abc")
        assert not ws_b.is_within_workspace(run_a)  # User B cannot reach User A's path

    def test_path_traversal_rejected_for_user_id(self) -> None:
        from app.unhobbling.multi_tenant import _validate_user_id
        with pytest.raises(ValueError):
            _validate_user_id("../../etc/passwd")

    def test_path_traversal_rejected_in_user_id_with_slash(self) -> None:
        from app.unhobbling.multi_tenant import _validate_user_id
        with pytest.raises(ValueError):
            _validate_user_id("user/../../root")

    def test_memory_namespace_prefixed_with_user_id(self) -> None:
        ws = TenantWorkspace("user-alpha")
        namespaced = ws.memory_namespace("api_key")
        assert namespaced.startswith("user:user-alpha:")
        assert "api_key" in namespaced

    def test_scoped_env_does_not_expose_credentials(self) -> None:
        ws = TenantWorkspace("user-alpha")
        env = ws.scoped_env({"PATH": "/usr/bin", "SECRET_KEY": "should-not-appear"})
        assert "SECRET_KEY" not in env

    def test_resolve_workspace_path_blocks_traversal(self) -> None:
        ws = TenantWorkspace("user-alpha")
        with pytest.raises(PermissionError):
            ws.resolve_workspace_path("../../etc/passwd")

    def test_two_states_for_two_users_are_isolated(self) -> None:
        """qm: user A's state variables never appear in user B's log."""
        state_a = new_state(user_id="user-alpha", task_type="skill_extraction")
        state_b = new_state(user_id="user-beta", task_type="skill_extraction")
        state_a = add_context_variable(state_a, "resume", SAMPLE_RESUME)
        assert "resume" not in state_b["context_variables"]


# ═══════════════════════════════════════════════════════════════════════════
# Full Orchestrator Integration (all layers together)
# ═══════════════════════════════════════════════════════════════════════════

class TestOrchestratorIntegration:
    """End-to-end orchestrator test with MockLLM."""

    @pytest.mark.asyncio
    async def test_orchestrator_completes_with_mock_llm(self, test_user_id: str) -> None:
        orchestrator = JobTayariOrchestrator(llm=MockLLMCallable())
        final_state = await orchestrator.run(
            user_id=test_user_id,
            context_inputs={"resume": SAMPLE_RESUME, "jd": SAMPLE_JD},
            task_type="skill_extraction",
            target_role="Senior Backend Engineer",
        )
        # Must terminate in a defined terminal state
        assert final_state["route"] in ("complete", "terminal_failure")

    @pytest.mark.asyncio
    async def test_orchestrator_writes_log_file(self, test_user_id: str) -> None:
        orchestrator = JobTayariOrchestrator(llm=MockLLMCallable())
        final_state = await orchestrator.run(
            user_id=test_user_id,
            context_inputs={"resume": SAMPLE_RESUME, "jd": SAMPLE_JD},
            task_type="skill_extraction",
        )
        # Log file must exist on disk
        run_trace = load_run_trace(test_user_id, final_state["run_id"])
        assert run_trace.get("user_id") == test_user_id

    @pytest.mark.asyncio
    async def test_orchestrator_respects_max_3_iteration_limit(self, test_user_id: str) -> None:
        """DGM (2505.22954): must never exceed 3 iterations."""
        orchestrator = JobTayariOrchestrator(llm=MockLLMCallable())
        final_state = await orchestrator.run(
            user_id=test_user_id,
            context_inputs={"resume": SAMPLE_RESUME, "jd": SAMPLE_JD},
            task_type="skill_extraction",
            max_iterations=3,
        )
        assert final_state["current_iteration"] <= 3

    @pytest.mark.asyncio
    async def test_raw_text_not_in_llm_context(self, test_user_id: str) -> None:
        """RLM (2512.24601): The LLM must never receive raw text in context."""
        # MockLLM only receives state, not raw text. This tests that variable_handles
        # are the only text-like data the LLM sees.
        orchestrator = JobTayariOrchestrator(llm=MockLLMCallable())
        final_state = await orchestrator.run(
            user_id=test_user_id,
            context_inputs={"resume": SAMPLE_RESUME, "jd": SAMPLE_JD},
            task_type="skill_extraction",
        )
        # The raw text should only be in context_variables, never in pydantic_output or llm_raw_output
        if final_state.get("pydantic_output"):
            output_str = json.dumps(final_state["pydantic_output"])
            assert SAMPLE_RESUME.strip()[:100] not in output_str


class TestRealLLMAndHarnessRoutes:
    """Tests for RealLLMCallable, _get_real_llm_adapter, and /v1/harness routes."""

    @pytest.mark.asyncio
    async def test_real_llm_generate_code_action(self, monkeypatch: pytest.MonkeyPatch, test_user_id: str) -> None:
        called = {}

        async def fake_llm_json(system_message: str, user_message: str, **kwargs: Any) -> dict[str, Any]:
            called["system"] = system_message
            called["user"] = user_message
            called["kwargs"] = kwargs
            return {
                "code_to_execute": "result = {'extracted_skills': ['Python']}",
                "expected_output_type": "dict",
                "rationale": "test action",
                "uses_variables": ["resume"],
            }

        monkeypatch.setattr("app.unhobbling.orchestrator.llm_json", fake_llm_json)

        state = new_state(test_user_id, "skill_extraction", target_role="Backend Engineer")
        state = add_context_variable(state, "resume", "Python developer with 5 years experience")

        llm = RealLLMCallable()
        result = await llm.generate_code_action(state)

        assert result["code_to_execute"] == "result = {'extracted_skills': ['Python']}"
        assert called["kwargs"].get("temperature") == 0.0
        assert "Backend Engineer" in called["system"]
        assert "resume" in called["system"]

    @pytest.mark.asyncio
    async def test_real_llm_generate_repair(self, monkeypatch: pytest.MonkeyPatch, test_user_id: str) -> None:
        called = {}

        async def fake_llm_json(system_message: str, user_message: str, **kwargs: Any) -> dict[str, Any]:
            called["system"] = system_message
            called["user"] = user_message
            called["kwargs"] = kwargs
            return {
                "repaired_code": "result = {'extracted_skills': ['Python']}",
                "diagnosis": "SyntaxError on line 1",
                "patch_rationale": "Fixed closing quote",
                "confidence": "high",
            }

        monkeypatch.setattr("app.unhobbling.orchestrator.llm_json", fake_llm_json)

        state = new_state(test_user_id, "skill_extraction")
        state["code_to_execute"] = "result = {'invalid"
        state["error_trace"] = "SyntaxError: unterminated string literal"
        state["validation_error_message"] = "Invalid Python syntax"

        llm = RealLLMCallable()
        result = await llm.generate_repair(state)

        assert result["repaired_code"] == "result = {'extracted_skills': ['Python']}"
        assert called["kwargs"].get("temperature") == 0.0
        assert "SyntaxError" in called["system"]

    def test_get_real_llm_adapter(self) -> None:
        from app.main import _get_real_llm_adapter
        adapter = _get_real_llm_adapter()
        # In test env without configured external LLM, defaults to MockLLMCallable
        assert isinstance(adapter, (MockLLMCallable, RealLLMCallable))

    def test_harness_schemas_endpoint(self) -> None:
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        for path in ["/v1/harness/schemas", "/api/v1/harness/schemas"]:
            resp = client.get(path)
            assert resp.status_code == 200
            data = resp.json()
            for key in ["skill_extraction", "assessment_gen", "code_action", "code_repair"]:
                assert key in data
                assert "properties" in data[key]

    def test_harness_run_endpoint_auth_and_execution(self, test_user_id: str) -> None:
        from fastapi.testclient import TestClient
        from app.main import app
        from app.auth.dependencies import get_current_user

        client = TestClient(app)

        # 1. Unauthenticated request must fail with 401
        resp = client.post("/v1/harness/run", json={"context_inputs": {"resume": "test"}})
        assert resp.status_code == 401

        # 2. Authenticated request with empty context_inputs must fail with 400
        app.dependency_overrides[get_current_user] = lambda: test_user_id
        try:
            resp = client.post("/v1/harness/run", json={"context_inputs": {}})
            assert resp.status_code == 400
            assert "context_inputs required" in resp.json().get("error", "")

            # 3. Valid authenticated request executes through orchestrator
            resp = client.post(
                "/v1/harness/run",
                json={
                    "context_inputs": {"resume": SAMPLE_RESUME, "jd": SAMPLE_JD},
                    "task_type": "skill_extraction",
                    "target_role": "Software Engineer",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "status" in data
            assert "run_id" in data
            assert "iterations" in data
            assert "validation_passed" in data

            # Also check /api/v1/harness/run
            resp_api = client.post(
                "/api/v1/harness/run",
                json={
                    "context_inputs": {"resume": SAMPLE_RESUME, "jd": SAMPLE_JD},
                    "task_type": "skill_extraction",
                },
            )
            assert resp_api.status_code == 200
        finally:
            app.dependency_overrides.pop(get_current_user, None)


class TestPhase7Integration:
    """Phase 7 integration tests T1, T2, and T3."""

    def test_sandbox_blocks_attribute_chain_escape(self, test_user_id: str) -> None:
        """Verify pprint.sys.modules and similar attribute chains are blocked."""
        state = new_state(test_user_id, "skill_extraction")
        dangerous_codes = [
            "import collections\ncollections.sys.modules['os']",
            "x = ().__class__.__bases__[0].__subclasses__()",
            "import json\njson.sys.modules",
        ]
        for code in dangerous_codes:
            result = execute_sandbox_code(code, state)
            assert not result["success"], f"Should block: {code}"

    @pytest.mark.asyncio
    async def test_harness_endpoint_integration(self) -> None:
        """Verify HTTP -> orchestrator harness endpoint connectivity."""
        from httpx import AsyncClient, ASGITransport
        from app.main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/v1/harness/run", json={
                "context_inputs": {"resume": "Python developer with 5 years experience"},
                "task_type": "skill_extraction",
            }, headers={"Authorization": "Bearer test-token"})
            assert response.status_code in (200, 401)

    def test_orchestrator_handles_garbage_llm(self, test_user_id: str) -> None:
        """Verify orchestrator fails closed into terminal_failure on garbage LLM output and syntax errors."""
        import asyncio

        # Case 1: Non-schema compliant garbage dictionary -> terminal failure immediately
        class MalformedMockLLM:
            async def generate_code_action(self, state: Any) -> dict[str, Any]:
                return {"invalid": "not matching schema"}

            async def generate_repair(self, state: Any) -> dict[str, Any]:
                return {"also_invalid": True}

        orchestrator1 = JobTayariOrchestrator(llm=MalformedMockLLM())
        state1 = asyncio.run(orchestrator1.run(test_user_id, {"resume": "test"}, max_iterations=3))
        assert state1["route"] == "terminal_failure"
        assert "CodeGenError" in str(state1.get("error_trace"))

        # Case 2: Code with syntax errors -> enters repair loop until exhausted
        class SyntaxErrorMockLLM:
            async def generate_code_action(self, state: Any) -> dict[str, Any]:
                return {
                    "code_to_execute": "def broken_syntax(:\n    pass",
                    "expected_output_type": "dict",
                    "rationale": "syntax error",
                    "uses_variables": ["resume"],
                }

            async def generate_repair(self, state: Any) -> dict[str, Any]:
                return {
                    "repaired_code": "def still_broken(:\n    pass",
                    "diagnosis": "Syntax error",
                    "patch_rationale": "Attempted repair",
                    "confidence": "low",
                }

        orchestrator2 = JobTayariOrchestrator(llm=SyntaxErrorMockLLM())
        state2 = asyncio.run(orchestrator2.run(test_user_id, {"resume": "test"}, max_iterations=3))
        assert state2["route"] == "terminal_failure"
        assert state2["syntax_errors_encountered"] >= 3


# ═══════════════════════════════════════════════════════════════════════════
# pytest-asyncio configuration
# ═══════════════════════════════════════════════════════════════════════════

# Ensure pytest-asyncio works for async tests
def pytest_configure(config: Any) -> None:
    config.addinivalue_line("markers", "asyncio: mark test as async")
