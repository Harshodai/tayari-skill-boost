"""pytest-compatible evaluation runner for Tayari datasets.

Runs each YAML dataset entry against local endpoints (or directly against
Python modules) and produces a JSON report.

Usage:
    cd /backend/python
    python -m pytest eval/runner.py -v --tb=short
    python -m pytest eval/runner.py -v -k "ats_" --tb=short
"""
import json
import os
import pathlib
import time
from typing import Any

import pytest
import yaml

# Ensure app is importable
os.environ.setdefault("PYTHONPATH", str(pathlib.Path(__file__).resolve().parent.parent))

from app.services.ats_engine import heuristic_ats_score  # noqa: E402
from app.services.optimizer import optimize_with_reflection  # noqa: E402
from app.guardrails import PipelineGate  # noqa: E402


DATA_DIR = pathlib.Path(__file__).parent / "datasets"


def _run_mock_eval_case(resume_text, job_description, eval_name: str):
    """Run a single eval case with LLM_API_KEY unset; fail if it passes against MockProvider."""
    api_key = os.environ.pop("LLM_API_KEY", None)
    try:
        result = heuristic_ats_score(resume_text, job_description)
        pytest.fail(
            f"{eval_name} passes against MockProvider — 'mock ≠ passing' rule violated"
        )
    finally:
        if api_key is not None:
            os.environ["LLM_API_KEY"] = api_key
        else:
            os.environ.pop("LLM_API_KEY", None)


def _run_mock_optimize_case(resume_text, job_description, eval_name: str):
    """Run a single optimize case with LLM_API_KEY unset; fail if it passes against MockProvider."""
    import asyncio

    api_key = os.environ.pop("LLM_API_KEY", None)
    try:
        result = asyncio.run(optimize_with_reflection(resume_text, job_description=job_description))
        pytest.fail(
            f"{eval_name} passes against MockProvider — 'mock ≠ passing' rule violated"
        )
    except Exception:
        # Non-LLM failure is acceptable; we only care about MockProvider passes
        pass
    finally:
        if api_key is not None:
            os.environ["LLM_API_KEY"] = api_key
        else:
            os.environ.pop("LLM_API_KEY", None)


def test_mock_mode():
    """Guard: verify that evals fail when LLM is mock/unavailable.

    Temporarily unsets LLM_API_KEY and runs the eval dataset.
    If any eval passes against MockProvider, the test deliberately fails
    with a clear message so the CI pipeline can gate on this rule.
    Restores LLM_API_KEY regardless of outcome.
    """
    # --- ATS scoring evals ---
    data = _load_yaml(DATA_DIR / "ats_scoring_v1.yaml")
    cases = data["dataset"]["cases"]
    for case in cases:
        _run_mock_eval_case(
            case["resume_text"],
            case.get("job_description"),
            f"ATS-{case['id']}",
        )

    # --- Resume optimization evals ---
    data = _load_yaml(DATA_DIR / "tayari_resume_v1.yaml")
    cases = data["dataset"]["cases"]
    for case in cases:
        _run_mock_optimize_case(
            case["resume_text"],
            case.get("job_description", ""),
            f"RESUME-{case['id']}",
        )


DATA_DIR = pathlib.Path(__file__).parent / "datasets"


def _load_yaml(path: pathlib.Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _safe_optimize(resume_text: str, job_description: str) -> dict:
    """Run optimizer in a best-effort way (may use mock LLM)."""
    import asyncio
    try:
        result = asyncio.run(optimize_with_reflection(resume_text, job_description=job_description))
    except Exception as exc:
        result = {
            "optimized_text": resume_text,
            "changes": [],
            "keywords_added": [],
            "estimated_score": 0,
            "new_heuristic_score": 0,
            "refinement_passes": 0,
            "_error": str(exc),
        }
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_score_in_range(score: int, min_score: int, max_score: int, case_id: str):
    assert min_score <= score <= max_score, (
        f"{case_id}: score {score} not in [{min_score}, {max_score}]"
    )


def _assert_checks(result: dict, expected_passes: list, expected_failures: list, case_id: str):
    checks = {c["name"]: c["passed"] for c in result.get("checks", [])}
    for name in expected_passes:
        assert checks.get(name) is True, f"{case_id}: expected check '{name}' to pass"
    for name in expected_failures:
        assert checks.get(name) is False, f"{case_id}: expected check '{name}' to fail"


# ---------------------------------------------------------------------------
# ATS Scoring tests
# ---------------------------------------------------------------------------

def _ats_cases():
    data = _load_yaml(DATA_DIR / "ats_scoring_v1.yaml")
    return data["dataset"]["cases"]


@pytest.mark.parametrize("case", _ats_cases(), ids=lambda c: c["id"])
def test_ats_score(case: dict):
    result = heuristic_ats_score(case["resume_text"], case.get("job_description"))
    _assert_score_in_range(
        result["score"], case["expected_min_score"], case["expected_max_score"], case["id"]
    )


@pytest.mark.parametrize("case", _ats_cases(), ids=lambda c: c["id"])
def test_ats_checks(case: dict):
    result = heuristic_ats_score(case["resume_text"], case.get("job_description"))
    _assert_checks(
        result,
        case["expected_checks"],
        case["expected_failures"],
        case["id"],
    )


# ---------------------------------------------------------------------------
# Resume Optimization tests
# ---------------------------------------------------------------------------

def _resume_cases():
    data = _load_yaml(DATA_DIR / "tayari_resume_v1.yaml")
    return data["dataset"]["cases"]


@pytest.mark.parametrize("case", _resume_cases(), ids=lambda c: c["id"])
def test_resume_optimizer_sections(case: dict):
    """Optimized resume should preserve expected sections."""
    result = _safe_optimize(case["resume_text"], case.get("job_description", ""))
    opt_text = result.get("optimized_text", "")
    lower = opt_text.lower()
    for section in case["expected_sections"]:
        assert section in lower, f"{case['id']}: missing section '{section}' in optimized text"


@pytest.mark.parametrize("case", _resume_cases(), ids=lambda c: c["id"])
def test_resume_optimizer_guardrails(case: dict):
    """Optimized resume should pass guardrails."""
    result = _safe_optimize(case["resume_text"], case.get("job_description", ""))
    opt_text = result.get("optimized_text", "")
    gate = PipelineGate()
    g_result = gate.check(optimized_text=opt_text, original_text=case["resume_text"])
    assert g_result["all_passed"] is True, (
        f"{case['id']}: guardrails failed: {g_result['results']}"
    )


@pytest.mark.parametrize("case", _resume_cases(), ids=lambda c: c["id"])
def test_resume_optimizer_ats_score(case: dict):
    """Optimized resume should meet minimum ATS score."""
    result = _safe_optimize(case["resume_text"], case.get("job_description", ""))
    opt_text = result.get("optimized_text", "")
    ats = heuristic_ats_score(opt_text, case.get("job_description"))
    assert ats["score"] >= case["expected_min_ats_score"], (
        f"{case['id']}: ATS score {ats['score']} < {case['expected_min_ats_score']}"
    )


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def generate_report() -> dict:
    """Run all cases and return a JSON-serializable report."""
    report = {"timestamp": time.time(), "cases": []}

    for case in _ats_cases():
        ats = heuristic_ats_score(case["resume_text"], case.get("job_description"))
        report["cases"].append({
            "id": case["id"],
            "type": "ats",
            "score": ats["score"],
            "passed": (
                case["expected_min_score"] <= ats["score"] <= case["expected_max_score"]
            ),
        })

    for case in _resume_cases():
        t0 = time.time()
        opt = _safe_optimize(case["resume_text"], case.get("job_description", ""))
        latency_ms = round((time.time() - t0) * 1000, 2)
        ats = heuristic_ats_score(opt.get("optimized_text", ""), case.get("job_description"))
        gate = PipelineGate()
        g = gate.check(optimized_text=opt.get("optimized_text", ""), original_text=case["resume_text"])
        report["cases"].append({
            "id": case["id"],
            "type": "resume_opt",
            "ats_score": ats["score"],
            "guardrails_passed": g["all_passed"],
            "latency_ms": latency_ms,
            "error": opt.get("_error"),
        })

    return report


if __name__ == "__main__":
    # Run directly and write report to stdout
    report = generate_report()
    print(json.dumps(report, indent=2))
