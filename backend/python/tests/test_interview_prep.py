"""Tests for InterviewPrepEngine.build_prep_pack (app/services/interview_prep.py).

llm_complete is stubbed so pack generation is deterministic and does not depend
on a real LLM being configured.
"""
import json

import pytest

from app.services import interview_prep
from app.services.llm_service import LLMNotConfiguredError

RESUME_TEXT = "DistinctiveResumeMarker: built a payments platform in Go."
JD_TEXT = "We seek engineers with distributed systems experience."

FENCED_JSON = (
    "Here is the prep pack:\n"
    "```json\n"
    + json.dumps(
        {
            "star_stories": [
                {
                    "topic": "Latency reduction",
                    "situation": "API service had high p99 latency.",
                    "task": "Reduce response times under 200ms.",
                    "action": "Added an async caching layer.",
                    "result": "Cut p99 latency from 800ms to 180ms.",
                }
            ],
            "anticipated_questions": [
                "Describe your caching strategy.",
                "How do you profile performance?",
            ],
            "mock_interview_prompt": "Roleplay as a senior interviewer at Acme for a Technical Screen.",
        }
    )
    + "\n```"
)


def _make_fake_llm(response):
    calls = []

    async def fake_llm(system, user, **kwargs):
        calls.append(user)
        return response

    return fake_llm, calls


@pytest.mark.asyncio
async def test_llm_path_parses_fenced_json(monkeypatch):
    fake_llm, _ = _make_fake_llm(FENCED_JSON)
    monkeypatch.setattr(interview_prep, "llm_complete", fake_llm)

    result = await interview_prep.InterviewPrepEngine.build_prep_pack(
        RESUME_TEXT, JD_TEXT, company_name="Acme"
    )

    assert result["generation_status"] == "llm"
    assert len(result["star_stories"]) == 1
    story = result["star_stories"][0]
    assert story["topic"] == "Latency reduction"
    assert story["result"] == "Cut p99 latency from 800ms to 180ms."
    assert result["anticipated_questions"] == [
        "Describe your caching strategy.",
        "How do you profile performance?",
    ]
    assert result["mock_interview_prompt"].startswith("Roleplay as a senior interviewer at Acme")
    assert result["company_name"] == "Acme"
    assert result["interview_stage"] == "Technical Screen"


@pytest.mark.asyncio
async def test_prompt_contains_resume_and_jd_content(monkeypatch):
    fake_llm, calls = _make_fake_llm(FENCED_JSON)
    monkeypatch.setattr(interview_prep, "llm_complete", fake_llm)

    await interview_prep.InterviewPrepEngine.build_prep_pack(RESUME_TEXT, JD_TEXT)

    assert "DistinctiveResumeMarker" in calls[0]
    assert "distributed systems" in calls[0]


@pytest.mark.asyncio
async def test_unparseable_response_falls_back(monkeypatch):
    fake_llm, _ = _make_fake_llm("Sorry, I cannot help with that.")
    monkeypatch.setattr(interview_prep, "llm_complete", fake_llm)

    result = await interview_prep.InterviewPrepEngine.build_prep_pack(
        RESUME_TEXT, JD_TEXT, company_name="Acme"
    )

    assert result["generation_status"] == "fallback"
    assert result["star_stories"] == []
    assert result["anticipated_questions"] == []
    assert "Acme" in result["mock_interview_prompt"]


@pytest.mark.asyncio
async def test_llm_raises_falls_back_without_crash(monkeypatch):
    async def raise_error(system, user, **kwargs):
        raise LLMNotConfiguredError("No LLM configured")

    monkeypatch.setattr(interview_prep, "llm_complete", raise_error)

    result = await interview_prep.InterviewPrepEngine.build_prep_pack(
        RESUME_TEXT, JD_TEXT, company_name="Acme", interview_stage="Onsite"
    )

    assert result["generation_status"] == "fallback"
    assert result["star_stories"] == []
    assert result["anticipated_questions"] == []
    assert "Acme" in result["mock_interview_prompt"]
    assert "Onsite" in result["mock_interview_prompt"]
