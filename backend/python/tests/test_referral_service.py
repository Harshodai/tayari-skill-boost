"""Tests for the Moat-1 referral draft engine.

Pure tests: llm_json is monkeypatched; nothing network-bound.
"""
import pytest

pytest.importorskip("pydantic")

from fastapi import HTTPException

from app.services.referral_service import (
    ReferralDraftVerdict,
    _validate_verdict,
    run_referral_draft,
)
from app.services.llm_service import LLMNotConfiguredError

MODULE = "app.services.referral_service"


def _valid_context():
    return {
        "contact": {
            "name": "Alice Chen",
            "title": "Engineering Manager",
            "company": "Acme",
            "relationship": "Worked together at Acme 2019-2022",
            "notes": "Managed backend team",
        },
        "job": {"title": "Senior Backend Engineer", "company": "Acme", "description": "Go services"},
        "user_context": {"full_name": "Jane Doe", "headline": "Backend Engineer", "skills": ["Go", "Postgres"]},
    }


def _verdict():
    return ReferralDraftVerdict(
        fit_score=88.0,
        subject="Referral ask for Acme Senior Backend Engineer",
        email_body="Hi Alice, we worked together at Acme on the backend team.\n\nI'd appreciate a referral...",
        linkedin_body="Hi Alice! Would you be open to referring me for the Acme role?",
        rationale="Former manager relationship with relevant team",
    )


@pytest.mark.asyncio
async def test_run_referral_draft_parses_verdict(monkeypatch):
    async def fake_llm_json(system_message, user_message, response_model=None, **kwargs):
        assert response_model is ReferralDraftVerdict
        return _verdict()

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    verdict = await run_referral_draft(**_valid_context())

    assert verdict.fit_score == 88.0
    assert "Acme" in verdict.subject
    assert verdict.email_body and verdict.linkedin_body
    assert verdict.rationale


@pytest.mark.asyncio
async def test_run_referral_draft_relationship_reaches_prompt(monkeypatch):
    seen = {}

    async def fake_llm_json(system_message, user_message, response_model=None, **kwargs):
        seen["user_message"] = user_message
        return _verdict()

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    await run_referral_draft(**_valid_context())

    assert "Worked together at Acme 2019-2022" in seen["user_message"]
    assert "Managed backend team" in seen["user_message"]


@pytest.mark.asyncio
async def test_run_referral_draft_rejects_unknown_kind(monkeypatch):
    async def fake_llm_json(**kwargs):
        raise AssertionError("llm_json must not be called for unknown kind")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    with pytest.raises(ValueError):
        await run_referral_draft(**_valid_context(), kind="spam")


@pytest.mark.asyncio
async def test_run_referral_draft_requires_relationship(monkeypatch):
    async def fake_llm_json(**kwargs):
        raise AssertionError("llm_json must not be called without relationship")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    ctx = _valid_context()
    ctx["contact"]["relationship"] = ""
    with pytest.raises(ValueError):
        await run_referral_draft(**ctx)


@pytest.mark.asyncio
async def test_run_referral_draft_requires_job_title(monkeypatch):
    async def fake_llm_json(**kwargs):
        raise AssertionError("llm_json must not be called without job title")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    ctx = _valid_context()
    ctx["job"]["title"] = ""
    with pytest.raises(ValueError):
        await run_referral_draft(**ctx)


@pytest.mark.asyncio
async def test_run_referral_draft_propagates_llm_not_configured(monkeypatch):
    async def raise_unconfigured(**kwargs):
        raise LLMNotConfiguredError("no LLM")

    monkeypatch.setattr(f"{MODULE}.llm_json", raise_unconfigured)

    with pytest.raises(LLMNotConfiguredError):
        await run_referral_draft(**_valid_context())


@pytest.mark.asyncio
async def test_endpoint_maps_llm_not_configured_to_503(monkeypatch):
    from fastapi.responses import JSONResponse
    from app.api.ai_routes import ReferralDraftRequest, create_referral_draft

    async def raise_unconfigured(**kwargs):
        raise LLMNotConfiguredError("no LLM")

    monkeypatch.setattr(f"{MODULE}.llm_json", raise_unconfigured)

    payload = ReferralDraftRequest.model_validate(_valid_context())
    response = await create_referral_draft(payload)
    assert isinstance(response, JSONResponse)
    assert response.status_code == 503
    assert response.body == b'{"error":"ai_service_unavailable"}'


@pytest.mark.asyncio
async def test_endpoint_rejects_missing_relationship(monkeypatch):
    from app.api.ai_routes import ReferralDraftRequest, create_referral_draft

    async def fake_llm_json(**kwargs):
        raise AssertionError("llm_json must not be called for invalid payload")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    ctx = _valid_context()
    ctx["contact"]["relationship"] = ""
    with pytest.raises(HTTPException) as exc:
        await create_referral_draft(ReferralDraftRequest.model_validate(ctx))
    assert exc.value.status_code == 400


def _verdict_with(subject: str, email_body: str) -> ReferralDraftVerdict:
    return ReferralDraftVerdict(
        fit_score=80.0,
        subject=subject,
        email_body=email_body,
        linkedin_body="Hi!",
        rationale="ok",
    )


def test_validate_verdict_accepts_10_word_subject():
    verdict = _verdict_with("one two three four five six seven eight nine ten", "Para one.\n\nPara two.")
    _validate_verdict(verdict)


def test_validate_verdict_rejects_11_word_subject():
    verdict = _verdict_with("one two three four five six seven eight nine ten eleven", "Para one.")
    with pytest.raises(ValueError):
        _validate_verdict(verdict)


def test_validate_verdict_accepts_two_paragraph_email():
    verdict = _verdict_with("Short subject", "Para one.\n\nPara two.")
    _validate_verdict(verdict)


def test_validate_verdict_rejects_three_paragraph_email():
    verdict = _verdict_with("Short subject", "Para one.\n\nPara two.\n\nPara three.")
    with pytest.raises(ValueError):
        _validate_verdict(verdict)


@pytest.mark.asyncio
async def test_run_referral_draft_rejects_out_of_contract_verdict(monkeypatch):
    async def fake_llm_json(system_message, user_message, response_model=None, **kwargs):
        return _verdict_with("one two three four five six seven eight nine ten eleven", "Para one.")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    with pytest.raises(ValueError):
        await run_referral_draft(**_valid_context())