"""Unit tests for Phase 14 LLM-powered semantic role intent matcher."""

import pytest
from app.scoring.semantic_role_matcher import SemanticRoleMatcher


class DummyLLMClient:
    def complete(self, prompt: str) -> str:
        return '{"canonical_role": "Data Engineer", "is_semantically_matched": true, "matched_concepts": ["pyspark", "airflow", "etl"], "confidence_score": 0.95}'


class FencedLLMClient:
    def __init__(self, response: str):
        self._response = response

    def complete(self, prompt: str) -> str:
        return self._response


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


def test_semantic_role_matcher_llm_unwraps_markdown_fence():
    client = FencedLLMClient(
        "```json\n"
        '{"canonical_role": "Data Engineer", "is_semantically_matched": true, '
        '"matched_concepts": ["etl"], "confidence_score": 0.9}\n'
        "```"
    )
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Building ETL pipelines with PySpark and Airflow",
        llm_client=client
    )

    assert res["source"] == "LLM_DYNAMIC"
    assert res["canonical_role_classification"] == "Data Engineer"
    assert res["is_semantically_matched"] is True
    assert res["semantic_match_score"] == 90.0


@pytest.mark.parametrize(
    "confidence,expected_score",
    [(1.5, 100.0), (-0.2, 0.0), (0.4, 40.0)],
)
def test_semantic_role_matcher_llm_clamps_confidence(confidence, expected_score):
    client = FencedLLMClient(
        '{"canonical_role": "Data Engineer", "is_semantically_matched": true, "confidence_score": %s}' % confidence
    )
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Building ETL pipelines with PySpark and Airflow",
        llm_client=client
    )

    assert res["source"] == "LLM_DYNAMIC"
    assert res["semantic_match_score"] == expected_score


def test_semantic_role_matcher_llm_non_numeric_confidence_falls_back():
    client = FencedLLMClient(
        '{"canonical_role": "Data Engineer", "is_semantically_matched": true, "confidence_score": "very confident"}'
    )
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Specializing in data engineer pipelines and SQL warehousing.",
        llm_client=client
    )

    assert res["source"] == "DYNAMIC_NLP_EXTRACTION"


def test_semantic_role_matcher_fallback():
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Specializing in data engineer pipelines and SQL warehousing."
    )

    assert res["is_semantically_matched"] is True
    assert res["source"] == "DYNAMIC_NLP_EXTRACTION"


def test_semantic_role_matcher_token_ratio_partial_match_not_sufficient():
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Looking for an engineer to optimize warehouse queries."
    )

    assert res["is_semantically_matched"] is False
    assert res["semantic_match_score"] == 90.0


def test_semantic_role_matcher_token_ratio_full_match():
    res = SemanticRoleMatcher.classify_posting(
        target_role="Data Engineer",
        job_title="Analytics Platform Wrangler",
        job_description="Looking for a data engineer to build pipelines."
    )

    assert res["is_semantically_matched"] is True
    assert res["semantic_match_score"] == 95.0


def test_semantic_role_matcher_degenerate_target_falls_back_to_substring():
    res = SemanticRoleMatcher.classify_posting(
        target_role="R&D",
        job_title="Head of R&D",
        job_description="Leading the research and development team."
    )

    assert res["is_semantically_matched"] is True
    assert res["canonical_role_classification"] == "R&D"
