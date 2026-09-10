"""
Tests for P1 (Pydantic Settings) and P2 (Refactored Endpoint Models).
"""
import pytest
from pydantic import ValidationError
from starlette.testclient import TestClient

from app.config import Settings, get_settings
from app.main import (
    app,
    ATSSimulateRequest,
    InterviewCopilotHintPayload,
    RecruiterPatternsRequest,
    AgentReachExtractRequest,
    AgentReachSearchRequest,
    AgentReachTranscribeRequest,
    CandidateBankMatchRequest,
    ATSDetectRequest,
    TruthCheckRequest,
    RecruiterLookupRequest,
)


@pytest.fixture
def internal_auth_headers(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_TOKEN", "test-internal-token")
    return {
        "X-Internal-Token": "test-internal-token",
        "X-User-Id": "00000000-0000-0000-0000-000000000001",
    }


def test_settings_validation():
    # 1. Valid settings with 32+ char secret
    s = Settings(
        APP_ENV="development",
        JWT_SECRET="valid-secret-with-at-least-32-chars-long",
    )
    assert s.app_env == "development"
    assert s.jwt_secret == "valid-secret-with-at-least-32-chars-long"
    assert s.autonomous_submit_enabled is False
    assert s.approval_signing_key == "test-key"

    # 2. Short secret fails fail-fast
    with pytest.raises(ValidationError):
        Settings(
            APP_ENV="production",
            JWT_SECRET="too-short",
        )

    # 3. Autonomous submit toggle
    s_sub = Settings(
        JWT_SECRET="valid-secret-with-at-least-32-chars-long",
        AUTONOMOUS_SUBMIT_ENABLED=True,
    )
    assert s_sub.autonomous_submit_enabled is True

    # 4. Cached get_settings() returns instance
    cached = get_settings()
    assert isinstance(cached, Settings)
    assert len(cached.jwt_secret) >= 32


def test_endpoint_models_instantiation():
    # 1. ATSSimulateRequest requires resume_text
    ats_req = ATSSimulateRequest(resume_text="Sample resume")
    assert ats_req.resume_text == "Sample resume"
    assert ats_req.ats_type == "generic"

    with pytest.raises(ValidationError):
        ATSSimulateRequest()  # missing required resume_text

    # 2. InterviewCopilotHintPayload
    hint_req = InterviewCopilotHintPayload(
        interviewer_transcript="Tell me about yourself",
        job_title="Software Engineer",
    )
    assert hint_req.interviewer_transcript == "Tell me about yourself"
    assert hint_req.job_title == "Software Engineer"

    # 3. RecruiterPatternsRequest
    rec_patt = RecruiterPatternsRequest()
    assert rec_patt.company_name == "Target Company"
    assert rec_patt.job_title == "Software Engineer"

    # 4. AgentReachExtractRequest
    agent_reach = AgentReachExtractRequest(
        url="https://example.com/article",
        platform="custom",
    )
    assert agent_reach.url == "https://example.com/article"

    # 5. AgentReachSearchRequest
    search_req = AgentReachSearchRequest(query="AI Engineer")
    assert search_req.query == "AI Engineer"

    # 6. AgentReachTranscribeRequest
    transcribe_req = AgentReachTranscribeRequest(url="https://example.com/audio.mp3")
    assert transcribe_req.provider == "auto"

    # 7. CandidateBankMatchRequest
    bank_req = CandidateBankMatchRequest(question_text="Years of experience?")
    assert bank_req.question_text == "Years of experience?"
    assert bank_req.custom_qa == {}

    # 8. ATSDetectRequest
    detect_req = ATSDetectRequest(url="https://boards.greenhouse.io/test/jobs/1")
    assert detect_req.url == "https://boards.greenhouse.io/test/jobs/1"

    # 9. TruthCheckRequest
    truth_req = TruthCheckRequest(original_text="Master resume", optimized_text="Tailored resume")
    assert truth_req.original_text == "Master resume"

    # 10. RecruiterLookupRequest
    lookup_req = RecruiterLookupRequest(company_name="Google", job_title="Tech Lead")
    assert lookup_req.company_name == "Google"
    assert lookup_req.job_title == "Tech Lead"
    assert lookup_req.user_name == "Candidate"


def test_endpoints_via_testclient(internal_auth_headers):
    client = TestClient(app)

    # 1. ats/simulate rejects invalid payload missing required resume_text with 422
    res = client.post("/api/v1/ats/simulate", json={}, headers=internal_auth_headers)
    assert res.status_code == 422

    # 2. recruiter/patterns succeeds with 200
    res = client.post(
        "/api/v1/recruiter/patterns",
        json={"company_name": "Acme Corp", "job_title": "Backend Dev"},
        headers=internal_auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["company"] == "Acme Corp"
    assert "patterns" in data

    # 3. guardrails/truth-check succeeds with 200
    res = client.post(
        "/api/v1/guardrails/truth-check",
        json={
            "original_text": "Software Engineer at Google",
            "optimized_text": "Software Engineer at Google with Go experience",
        },
        headers=internal_auth_headers,
    )
    assert res.status_code == 200
    truth_data = res.json()
    assert "passed" in truth_data
    assert "truth_score" in truth_data

    # 4. ats/detect succeeds with 200
    res = client.post(
        "/api/v1/ats/detect",
        json={"url": "https://boards.greenhouse.io/example/jobs/123"},
        headers=internal_auth_headers,
    )
    assert res.status_code == 200
    detect_data = res.json()
    assert detect_data["vendor"] == "greenhouse"

    # 5. recruiter/lookup succeeds with 200
    res = client.post(
        "/api/v1/recruiter/lookup",
        json={
            "company_name": "Stripe",
            "job_title": "Software Engineer",
            "user_name": "Test User",
            "user_skills": ["Python", "FastAPI"],
        },
        headers=internal_auth_headers,
    )
    assert res.status_code == 200
    lookup_data = res.json()
    assert "suggested_emails" in lookup_data
