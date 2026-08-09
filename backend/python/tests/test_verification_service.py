"""Tests for the V3 verification endpoint (truthfulness + screening scorers).

Pure tests: llm_json is monkeypatched; nothing network-bound.
"""
import pytest

pytest.importorskip("pydantic")

from fastapi import HTTPException

from app.services.verification_service import (
    ScreeningVerdict,
    TruthfulnessVerdict,
    run_verification,
)
from app.services.llm_service import LLMNotConfiguredError

MODULE = "app.services.verification_service"


def _verdict(v):
    return v


@pytest.mark.asyncio
async def test_run_verification_parses_both_models(monkeypatch):
    async def fake_llm_json(system_message, user_message, response_model=None, **kwargs):
        if response_model is TruthfulnessVerdict:
            return TruthfulnessVerdict(truthful_score=84.0, red_flags=["Year overlaps with prior role"])
        if response_model is ScreeningVerdict:
            return ScreeningVerdict(
                screening_score=73.0,
                strengths=["Distributed systems"],
                gaps=["No Kubernetes evidence"],
                sample_questions=["Describe a cache stampede fix"],
            )
        raise AssertionError(f"unexpected model {response_model}")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    result = await run_verification("Jane Doe\nSenior Engineer at Acme.")

    assert result["truthful_score"] == 84.0
    assert result["red_flags"] == ["Year overlaps with prior role"]
    assert result["screening_score"] == 73.0
    assert result["strengths"] == ["Distributed systems"]
    assert result["gaps"] == ["No Kubernetes evidence"]
    assert result["sample_questions"] == ["Describe a cache stampede fix"]


@pytest.mark.asyncio
async def test_run_verification_rejects_blank_text(monkeypatch):
    async def fake_llm_json(**kwargs):
        raise AssertionError("llm_json must not be called for blank input")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    with pytest.raises(ValueError):
        await run_verification("   ")


@pytest.mark.asyncio
async def test_run_verification_propagates_llm_not_configured(monkeypatch):
    async def raise_unconfigured(**kwargs):
        raise LLMNotConfiguredError("no LLM")

    monkeypatch.setattr(f"{MODULE}.llm_json", raise_unconfigured)

    with pytest.raises(LLMNotConfiguredError):
        await run_verification("Jane Doe\nSenior Engineer at Acme.")


@pytest.mark.asyncio
async def test_endpoint_maps_llm_not_configured_to_503(monkeypatch):
    from fastapi.responses import JSONResponse
    from app.api.ai_routes import submit_verification
    from app.api.ai_routes import VerificationRequest

    async def raise_unconfigured(**kwargs):
        raise LLMNotConfiguredError("no LLM")

    monkeypatch.setattr(f"{MODULE}.llm_json", raise_unconfigured)

    response = await submit_verification(VerificationRequest(resume_text="Jane Doe\nEngineer."))
    assert isinstance(response, JSONResponse)
    assert response.status_code == 503
    assert response.body == b'{"error":"ai_service_unavailable"}'


@pytest.mark.asyncio
async def test_endpoint_rejects_empty_text(monkeypatch):
    from fastapi.responses import JSONResponse
    from app.api.ai_routes import submit_verification
    from app.api.ai_routes import VerificationRequest

    async def fake_llm_json(**kwargs):
        raise AssertionError("llm_json must not be called for empty input")

    monkeypatch.setattr(f"{MODULE}.llm_json", fake_llm_json)

    with pytest.raises(HTTPException) as exc:
        await submit_verification(VerificationRequest(resume_text="  "))
    assert exc.value.status_code == 400