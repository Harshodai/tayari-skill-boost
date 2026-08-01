"""Unit tests for Phase 14 LLM-powered semantic role intent matcher."""

import pytest
from app.scoring.semantic_role_matcher import SemanticRoleMatcher


class DummyLLMClient:
    def complete(self, prompt: str) -> str:
        return '{"canonical_role": "Data Engineer", "is_semantically_matched": true, "matched_concepts": ["pyspark", "airflow", "etl"], "confidence_score": 0.95}'


def test_semantic_role_matcher_llm():
    client = DummyLLMClient()
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Building ETL pipelines with PySpark and Airflow",
        llm_client=client
    )

    assert res["canonical_role_classification"] == "Data Engineer"
    assert res["is_semantically_matched"] is True
    assert res["semantic_match_score"] == 95.0
    assert res["source"] == "LLM_DYNAMIC"


def test_semantic_role_matcher_fallback():
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Specializing in data engineer pipelines and SQL warehousing."
    )

    assert res["is_semantically_matched"] is True
    assert res["source"] == "DYNAMIC_NLP_EXTRACTION"
