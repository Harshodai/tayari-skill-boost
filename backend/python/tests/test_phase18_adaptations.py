"""Unit tests for Phase 18 end-to-end autonomous application execution pipeline."""

import pytest
from app.ai_proofing import drafter_reviewer
from app.services import end_to_end_pipeline
from app.services.end_to_end_pipeline import EndToEndPipelineEngine
from app.services.llm_service import LLMNotConfiguredError


def _fake_llm_draft():
    """Async drafter stub returning a real, skill-grounded draft (draft_source llm)."""
    async def fake_drafter(resume_text, jd_text, target_company="", target_role="", max_iterations=2):
        return {
            "tailored_cover_letter": f"Dear Hiring Manager at {target_company}, I am a strong fit for the {target_role} role.",
            "tailored_resume_bullets": ["Engineered enterprise solutions using Python."],
            "reviewer_score": 92,
            "reviewer_feedback": "Excellent alignment.",
            "iterations_run": 1,
            "ats_parseable": True,
            "draft_source": "llm",
        }

    return fake_drafter


def test_end_to_end_pipeline_engine(monkeypatch):
    monkeypatch.setattr(
        end_to_end_pipeline.DrafterReviewerEngine,
        "generate_tailored_application",
        _fake_llm_draft(),
    )

    res = EndToEndPipelineEngine.process_job_application(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Hiring a Data Engineer to build ETL pipelines with PySpark, Airflow, and Snowflake in Python and SQL.",
        candidate_skills=["Python", "SQL", "Airflow", "PySpark"],
        verified_candidate_facts=["Python", "SQL", "Airflow", "PySpark"],
        company_name="Acme Corp"
    )

    assert res["target_role"] == "Data Engineer"
    assert res["company_name"] == "Acme Corp"
    assert res["pipeline_status"] == "COMPLETED_READY_FOR_SUBMISSION"
    assert res["ghost_job_risk"]["ghost_job_risk_score"] < 50
    assert res["semantic_role_match"]["is_semantically_matched"] is True
    assert res["ats_5d_fit"]["overall_fit_score"] > 50
    assert len(res["factually_verified_bullets"]) > 0
    assert res["factually_verified_bullets"][0]["is_factually_verified"] is True


def test_no_llm_drafter_fallback_is_blocked(monkeypatch):
    async def raise_error(system, user, **kwargs):
        raise LLMNotConfiguredError("No LLM configured")

    monkeypatch.setattr(drafter_reviewer, "llm_complete", raise_error)

    res = EndToEndPipelineEngine.process_job_application(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Hiring a Data Engineer to build ETL pipelines with PySpark, Airflow, and Snowflake in Python and SQL.",
        candidate_skills=["Python", "SQL", "Airflow", "PySpark"],
        verified_candidate_facts=["Python", "SQL", "Airflow", "PySpark"],
        company_name="Acme Corp"
    )

    assert res["pipeline_status"] == "BLOCKED_UNVERIFIED_CLAIMS"
    assert res["factually_verified_bullets"] == []
