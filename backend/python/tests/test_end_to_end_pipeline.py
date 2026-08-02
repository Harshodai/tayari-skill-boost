"""Unit tests for end-to-end pipeline stage isolation and guardrail-gated status."""

import pytest

from app.services import end_to_end_pipeline
from app.services.end_to_end_pipeline import EndToEndPipelineEngine


def _run_pipeline(**overrides):
    return EndToEndPipelineEngine.process_job_application(
        target_role=overrides.get("target_role", "Data Engineer"),
        job_title=overrides.get("job_title", "Analytics Platform Wrangler"),
        job_description=overrides.get(
            "job_description",
            "Hiring a Data Engineer to build ETL pipelines with PySpark, Airflow, and Snowflake in Python and SQL.",
        ),
        candidate_skills=overrides.get("candidate_skills", ["Python", "SQL", "Airflow", "PySpark"]),
        verified_candidate_facts=overrides.get("verified_candidate_facts", ["Python", "SQL", "Airflow", "PySpark"]),
        company_name=overrides.get("company_name", "Acme Corp"),
    )


def test_pipeline_blocks_high_ghost_job_risk(monkeypatch):
    monkeypatch.setattr(
        end_to_end_pipeline.LegitimacyChecker,
        "evaluate_posting_legitimacy",
        lambda title, description: {
            "title": title,
            "days_posted": 60,
            "ghost_job_risk_score": 55.0,
            "is_ghost_job_risk": True,
            "risk_factors": ["Posting is stale (60 days old)"],
            "recommendation": "High ghost job risk — proceed with caution or verify company contact",
        },
    )

    res = _run_pipeline()

    assert res["pipeline_status"] == "BLOCKED_HIGH_GHOST_JOB_RISK"


def test_pipeline_blocks_role_mismatch(monkeypatch):
    monkeypatch.setattr(
        end_to_end_pipeline.SemanticRoleMatcher,
        "classify_posting",
        lambda target_role, job_title, job_description: {
            "target_role_query": target_role,
            "actual_job_title": job_title,
            "canonical_role_classification": "Other",
            "semantic_match_score": 40.0,
            "is_semantically_matched": False,
            "matched_concepts": [],
            "source": "SCHEMA_BASED_EXTRACTION",
        },
    )

    res = _run_pipeline()

    assert res["pipeline_status"] == "BLOCKED_ROLE_MISMATCH"


def test_pipeline_blocks_unverified_claims(monkeypatch):
    monkeypatch.setattr(
        end_to_end_pipeline.OntologyGuard,
        "validate_claim",
        lambda claim_text, verified_skills, verified_companies: {
            "is_valid": False,
            "claim_text": claim_text,
            "unverified_mentions": ["react"],
            "status": "FLAGGED_UNVERIFIED",
        },
    )

    res = _run_pipeline()

    assert res["pipeline_status"] == "BLOCKED_UNVERIFIED_CLAIMS"
    assert all(not b["is_factually_verified"] for b in res["factually_verified_bullets"])


def test_pipeline_stage_failure_isolation(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("5d fit exploded")

    monkeypatch.setattr(end_to_end_pipeline, "evaluate_5d_fit", boom)

    res = _run_pipeline()

    assert res["ats_5d_fit"]["status"] == "failed"
    assert res["ats_5d_fit"]["overall_fit_score"] == 0.0
    assert res["ghost_job_risk"]["status"] == "ok"
    assert res["semantic_role_match"]["status"] == "ok"
    assert res["pipeline_status"] == "COMPLETED_READY_FOR_SUBMISSION"


def test_pipeline_safe_key_retrieval_missing_is_valid(monkeypatch):
    monkeypatch.setattr(
        end_to_end_pipeline.OntologyGuard,
        "validate_claim",
        lambda claim_text, verified_skills, verified_companies: {
            "claim_text": claim_text,
            "unverified_mentions": [],
            "status": "APPROVED",
        },
    )

    res = _run_pipeline()

    assert len(res["factually_verified_bullets"]) > 0
    assert all(b["is_factually_verified"] is False for b in res["factually_verified_bullets"])
