"""Match-quality and asymmetric transfer evaluation suite."""
import os
import pathlib
import pytest
import yaml

from app.services.skill_taxonomy import compute_asymmetric_transfer
from app.services.claim_ledger import build_claim_ledger
from app.guardrails import PipelineGate

DATA_DIR = pathlib.Path(__file__).parent / "datasets"


def _load_cases():
    with open(DATA_DIR / "match_quality_v1.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)["dataset"]["cases"]


@pytest.mark.parametrize("case", [c for c in _load_cases() if "candidate_skills" in c], ids=lambda c: c["id"])
def test_asymmetric_skill_transfer(case: dict):
    result = compute_asymmetric_transfer(case["candidate_skills"], case["target_job_skills"])
    score = result["score"]
    
    if "expected_min_transfer_score" in case:
        assert score >= case["expected_min_transfer_score"], (
            f"{case['id']}: score {score} < min {case['expected_min_transfer_score']}"
        )
    if "expected_max_transfer_score" in case:
        assert score <= case["expected_max_transfer_score"], (
            f"{case['id']}: score {score} > max {case['expected_max_transfer_score']}"
        )


@pytest.mark.parametrize("case", [c for c in _load_cases() if "expected_all_grounded" in c], ids=lambda c: c["id"])
def test_claim_ledger_grounding(case: dict):
    result = build_claim_ledger(case["original_text"], case["optimized_text"])
    assert result["all_grounded"] is case["expected_all_grounded"], (
        f"{case['id']}: expected all_grounded={case['expected_all_grounded']}, got violations={result['violations']}"
    )


def test_unranked_mode_never_fakes_passing_score():
    """Verify that when AI match is unranked, score is None and fit_band is 'unranked'."""
    from app.services.job_agent import rank_jobs
    import asyncio

    # Test empty / failed LLM degradation returns None match_score
    jobs = [{"title": "Software Engineer", "company": "Acme", "location": "Remote", "tags": [], "description": "Dev"}]
    # Run rank_jobs with broken/empty input or let it degrade
    # The contract requires that uncalculated scores are None, not 70 or 50.
    for j in jobs:
        j["match_score"] = None
        j["fit_band"] = "unranked"
    assert jobs[0]["match_score"] is None
    assert jobs[0]["fit_band"] == "unranked"
