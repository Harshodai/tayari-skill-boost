"""Unit tests for Phase 18 end-to-end autonomous application execution pipeline."""

import pytest
from app.services.end_to_end_pipeline import EndToEndPipelineEngine


def test_end_to_end_pipeline_engine():
    res = EndToEndPipelineEngine.process_job_application(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Building Data Engineering ETL pipelines with PySpark, Airflow, and Snowflake in Python and SQL.",
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
