"""Tests for the resume generate-pdf endpoint (LLM optimize -> local Typst render).

Pure tests: no real LLM, no real typst subprocess.
"""
import base64
import pytest

pytest.importorskip("pydantic")

from fastapi import HTTPException

from app.main import (
    GenerateResumePdfRequest,
    OptimizedProfile,
    _UI_TEMPLATE_MAP,
    _TEMPLATE_FALLBACK,
    _map_profile_keys,
    _resolve_template,
    generate_resume_pdf_endpoint,
)
from app.export.typst_exporter import TEMPLATES
from app.services.llm_service import LLMNotConfiguredError


def _valid_payload(**overrides):
    payload = {
        "resume_text": "Jane Doe\nSenior Engineer at Acme.",
        "profile_data": {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "skills": ["Python", "Go"],
            "experience": [
                {
                    "title": "Senior Engineer",
                    "company": "Acme",
                    "startDate": "2020",
                    "endDate": "2024",
                    "description": "Built backend services.",
                    "achievements": ["Reduced p99 latency by 40%"],
                }
            ],
            "education": [{"degree": "B.S.", "institution": "State U", "year": "2018"}],
        },
        "analysis": {
            "overall_score": 72,
            "missing_keywords": ["Kubernetes", "Docker"],
            "summary_recommendation": "Add quantified achievements.",
        },
        "applied_suggestions": ["Add Kubernetes"],
        "job_description": "Senior backend engineer with Kubernetes and Docker.",
        "template": "professional",
    }
    payload.update(overrides)
    return payload


def _valid_request(**overrides):
    return GenerateResumePdfRequest.model_validate(_valid_payload(**overrides))


def test_template_map_covers_all_ui_names_and_fallback():
    expected = {
        "modern": "modern_tech",
        "professional": "executive_slate",
        "creative": "creative_compact",
        "minimal": "minimalist_ats",
        "tech": "faang_single_page",
        "executive": "executive",
    }
    assert _UI_TEMPLATE_MAP == expected
    for ui_name, exporter_name in _UI_TEMPLATE_MAP.items():
        assert exporter_name in TEMPLATES, f"UI template {ui_name} maps to unknown exporter {exporter_name}"
    assert _resolve_template("totally_unknown") == _TEMPLATE_FALLBACK
    assert _resolve_template("") == _TEMPLATE_FALLBACK


def test_profile_key_mapping_dates_bullets_school():
    mapped = _map_profile_keys(_valid_payload()["profile_data"])
    assert mapped["full_name"] == "Jane Doe"
    assert mapped["email"] == "jane@example.com"
    assert mapped["skills"] == ["Python", "Go"]
    assert mapped["experience"][0]["title"] == "Senior Engineer"
    assert mapped["experience"][0]["company"] == "Acme"
    assert mapped["experience"][0]["dates"] == "2020 \u2013 2024"
    assert mapped["experience"][0]["bullets"] == ["Reduced p99 latency by 40%"]
    assert mapped["education"][0]["degree"] == "B.S."
    assert mapped["education"][0]["school"] == "State U"
    assert mapped["education"][0]["year"] == "2018"


def test_profile_key_mapping_description_fallback_and_exporter_keys():
    profile = {
        "name": "John Roe",
        "experience": [
            {"title": "Engineer", "company": "Beta", "startDate": "2019", "endDate": "2021", "description": "Only description, no achievements."},
            {"title": "Engineer", "company": "Gamma", "dates": "2015 \u2013 2018", "bullets": ["Existing bullet"]},
        ],
        "education": [{"degree": "M.S.", "school": "Known U", "year": "2020"}],
    }
    mapped = _map_profile_keys(profile)
    assert mapped["experience"][0]["bullets"] == ["Only description, no achievements."]
    assert mapped["experience"][1]["dates"] == "2015 \u2013 2018"
    assert mapped["experience"][1]["bullets"] == ["Existing bullet"]
    assert mapped["education"][0]["school"] == "Known U"


@pytest.mark.asyncio
async def test_generate_pdf_base64_round_trip(monkeypatch):
    async def fake_llm_json(system_message, user_message, response_model=None, **kwargs):
        assert "Overall Score: 72/100" in user_message
        assert "Kubernetes, Docker" in user_message
        assert "1. Add Kubernetes" in user_message
        return response_model(
            full_name="Jane Doe",
            summary="Optimized summary with quantified wins.",
            skills=["Python", "Go", "Kubernetes"],
            experience=[
                {
                    "title": "Senior Engineer",
                    "company": "Acme",
                    "dates": "2020 \u2013 2024",
                    "bullets": ["Reduced p99 latency by 40%", "Built backend services."],
                }
            ],
            education=[{"degree": "B.S.", "school": "State U", "year": "2018"}],
        )

    monkeypatch.setattr("app.main.llm_json", fake_llm_json)
    monkeypatch.setattr("app.export.typst_exporter.compile_typst_to_pdf", lambda code: b"%PDF-fake")

    result = await generate_resume_pdf_endpoint(_valid_request())
    assert set(result.keys()) == {"pdf_base64"}
    decoded = base64.b64decode(result["pdf_base64"], validate=True)
    assert decoded == b"%PDF-fake"


@pytest.mark.asyncio
async def test_generate_pdf_null_profile_builds_from_resume_text(monkeypatch):
    captured = {}

    async def fake_llm_json(system_message, user_message, response_model=None, **kwargs):
        captured["user_message"] = user_message
        return response_model(
            full_name="Jane Doe",
            summary="Constructed from resume text.",
            skills=["Python", "Go"],
            experience=[
                {
                    "title": "Senior Engineer",
                    "company": "Acme",
                    "dates": "2020 \u2013 2024",
                    "bullets": ["Reduced p99 latency by 40%"],
                }
            ],
            education=[{"degree": "B.S.", "school": "State U", "year": "2018"}],
        )

    monkeypatch.setattr("app.main.llm_json", fake_llm_json)
    monkeypatch.setattr("app.export.typst_exporter.compile_typst_to_pdf", lambda code: b"%PDF-fake")

    result = await generate_resume_pdf_endpoint(_valid_request(profile_data=None))
    assert set(result.keys()) == {"pdf_base64"}
    decoded = base64.b64decode(result["pdf_base64"], validate=True)
    assert decoded == b"%PDF-fake"
    assert "Jane Doe\nSenior Engineer at Acme." in captured["user_message"]
    assert "construct the complete resume profile" in captured["user_message"]


@pytest.mark.asyncio
async def test_generate_pdf_503_when_llm_unconfigured(monkeypatch):
    async def raise_unconfigured(*args, **kwargs):
        raise LLMNotConfiguredError("no LLM configured")

    monkeypatch.setattr("app.main.llm_json", raise_unconfigured)

    response = await generate_resume_pdf_endpoint(_valid_request())
    assert response.status_code == 503
    assert response.body == b'{"error":"ai_service_unavailable"}'


@pytest.mark.asyncio
async def test_generate_pdf_400_missing_fields():
    with pytest.raises(HTTPException) as exc:
        await generate_resume_pdf_endpoint(_valid_request(resume_text="", profile_data={}, analysis={}))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_generate_pdf_400_oversized_inputs():
    with pytest.raises(HTTPException) as exc:
        await generate_resume_pdf_endpoint(_valid_request(resume_text="x" * 50_001))
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        await generate_resume_pdf_endpoint(_valid_request(job_description="x" * 20_001))
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        await generate_resume_pdf_endpoint(_valid_request(applied_suggestions=["s"] * 51))
    assert exc.value.status_code == 400


def test_request_model_contract():
    payload = GenerateResumePdfRequest.model_validate(_valid_payload())
    assert payload.resume_text
    assert payload.profile_data["name"] == "Jane Doe"
    assert payload.analysis["overall_score"] == 72
    assert payload.applied_suggestions == ["Add Kubernetes"]
    assert payload.job_description
    assert payload.template == "professional"
