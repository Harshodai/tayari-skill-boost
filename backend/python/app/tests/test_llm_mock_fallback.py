"""Pytest: verify LLM-dependent endpoints return 503 when LLM_API_KEY is unset.

This guard enforces the 'mock ≠ passing' rule — if an endpoint returns 200
against MockProvider, the test fails, preventing false confidence in AI results.
"""
from __future__ import annotations

import os
from fastapi.testclient import TestClient
import pytest

from app.main import app


client = TestClient(app)


@pytest.fixture(autouse=True)
def unset_llm_api_key():
    """Unset LLM_API_KEY for every test in this module so endpoints hit MockProvider."""
    api_key = os.environ.pop("LLM_API_KEY", None)
    yield
    if api_key is not None:
        os.environ["LLM_API_KEY"] = api_key


@pytest.fixture
def internal_auth_headers(monkeypatch):
    """optimizer/optimize and cover-letter/generate require an authenticated
    user (Depends(get_current_user)) for provenance capture — unlike the
    other routes in this module, an unauthenticated request 401s before ever
    reaching the LLM-not-configured check. Use the same trusted-gateway
    headers as test_capability_gates.py to get past auth."""
    monkeypatch.setenv("AI_INTERNAL_TOKEN", "test-internal-token")
    return {
        "X-Internal-Token": "test-internal-token",
        "X-User-Id": "00000000-0000-0000-0000-000000000001",
    }


def test_optimizer_optimize_returns_503_without_llm_key(internal_auth_headers):
    """/api/v1/optimizer/optimize must return 503 when LLM is not configured."""
    resp = client.post("/api/v1/optimizer/optimize",
                       json={"resume_text": "Senior Engineer with 5 years Python experience",
                             "job_description": "We need a Python engineer",
                             "target_role": "Software Engineer"},
                       headers=internal_auth_headers)
    assert resp.status_code == 503, (
        f"Expected 503 when LLM not configured, got {resp.status_code}: {resp.text}"
    )


def test_cover_letter_generate_returns_503_without_llm_key(internal_auth_headers):
    """/api/v1/cover-letter/generate must return 503 when LLM is not configured."""
    resp = client.post("/api/v1/cover-letter/generate",
                       json={"resume_text": "Senior Engineer with 5 years Python experience",
                             "job_title": "Software Engineer",
                             "company_name": "TechCorp",
                             "job_description": "We need a Python engineer",
                             "tone": "formal"},
                       headers=internal_auth_headers)
    assert resp.status_code == 503, (
        f"Expected 503 when LLM not configured, got {resp.status_code}: {resp.text}"
    )


def test_resumes_analyze_text_returns_503_without_llm_key():
    """/api/v1/resumes/analyze-text must return 503 when LLM is not configured."""
    resp = client.post("/api/v1/resumes/analyze-text",
                       json={"resume_text": "Senior Engineer with 5 years Python experience",
                             "job_description": "We need a Python engineer",
                             "custom_instructions": ""})
    assert resp.status_code == 503, (
        f"Expected 503 when LLM not configured, got {resp.status_code}: {resp.text}"
    )


def test_resumes_generate_pdf_returns_503_without_llm_key():
    """/api/v1/resumes/generate-pdf must return 503 when LLM is not configured."""
    resp = client.post("/api/v1/resumes/generate-pdf",
                       json={"resume_text": "Senior Engineer with 5 years Python experience",
                             "analysis": {"overall_score": 80, "summary": "good"},
                             "profile_data": {},
                             "applied_suggestions": []})
    assert resp.status_code == 503, (
        f"Expected 503 when LLM not configured, got {resp.status_code}: {resp.text}"
    )