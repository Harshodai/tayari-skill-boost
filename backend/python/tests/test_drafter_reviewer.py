"""Tests for the Drafter-Reviewer loop (app/ai_proofing/drafter_reviewer.py).

llm_complete is stubbed with queued responses so the loop is deterministic
and does not depend on a real LLM being configured.
"""
import json

import pytest

from app.ai_proofing import drafter_reviewer
from app.services.llm_service import LLMNotConfiguredError

DRAFT_JSON = json.dumps({
    "cover_letter": "Dear Hiring Manager, I am a strong fit.",
    "tailored_bullets": ["Led high-impact initiatives."],
})
REVISED_JSON = json.dumps({
    "cover_letter": "Dear Hiring Manager, I delivered quantified impact.",
    "tailored_bullets": ["Led initiatives increasing revenue by 20%."],
})


def _make_fake_llm(responses):
    """Async fake for llm_complete that returns queued responses in order."""
    calls = []

    async def fake_llm(system, user, **kwargs):
        calls.append(user)
        return responses.pop(0)

    return fake_llm, calls


def _run(monkeypatch, fake_llm, **kwargs):
    monkeypatch.setattr(drafter_reviewer, "llm_complete", fake_llm)
    return drafter_reviewer.DrafterReviewerEngine.generate_tailored_application(
        resume_text="resume", jd_text="jd", target_company="Acme", target_role="Engineer", **kwargs
    )


@pytest.mark.asyncio
async def test_review_loop_reaches_threshold_and_revises_draft(monkeypatch):
    fake_llm, calls = _make_fake_llm([
        DRAFT_JSON,                                   # drafter
        "SCORE: 60\nREVIEW: Add quantified impact.",  # reviewer 1
        REVISED_JSON,                                 # revision
        "SCORE: 92/100\nREVIEW: Excellent alignment.",  # reviewer 2
    ])

    result = await _run(monkeypatch, fake_llm)

    assert result["reviewer_score"] == 92
    assert result["reviewer_feedback"] == "Excellent alignment."
    assert result["iterations_run"] == 2
    assert result["tailored_cover_letter"] == "Dear Hiring Manager, I delivered quantified impact."
    assert result["tailored_resume_bullets"] == ["Led initiatives increasing revenue by 20%."]
    assert result["ats_parseable"] is True
    assert result["draft_source"] == "llm"
    assert len(calls) == 4
    assert "Add quantified impact." in calls[2]  # feedback fed into the revision prompt


@pytest.mark.asyncio
async def test_loop_stops_after_max_iterations(monkeypatch):
    fake_llm, calls = _make_fake_llm([
        DRAFT_JSON, "SCORE: 70\nREVIEW: Needs work.",
        REVISED_JSON, "SCORE: 70\nREVIEW: Still needs work.",
        REVISED_JSON, "SCORE: 70\nREVIEW: Again.",
    ])

    result = await _run(monkeypatch, fake_llm, max_iterations=3)

    assert result["reviewer_score"] == 70
    assert result["iterations_run"] == 3
    assert len(calls) == 6  # 1 draft + 3 reviews + 2 revisions


@pytest.mark.asyncio
async def test_score_is_clamped_to_0_100(monkeypatch):
    fake_llm, _ = _make_fake_llm([DRAFT_JSON, "SCORE: 250\nREVIEW: Great."])

    result = await _run(monkeypatch, fake_llm)

    assert result["reviewer_score"] == 100


@pytest.mark.asyncio
async def test_fallback_when_review_unparseable(monkeypatch):
    fake_llm, calls = _make_fake_llm([DRAFT_JSON, "The draft needs improvement but I cannot score it."])

    result = await _run(monkeypatch, fake_llm)

    assert result["reviewer_score"] == 88
    assert result["reviewer_feedback"] == "Strong match with clear alignment to job requirements."
    assert result["iterations_run"] == 1
    assert len(calls) == 2  # no revision attempted on parse failure


@pytest.mark.asyncio
async def test_fallback_when_llm_not_configured(monkeypatch):
    async def raise_error(system, user, **kwargs):
        raise LLMNotConfiguredError("No LLM configured")

    result = await _run(monkeypatch, raise_error)

    assert result["reviewer_score"] == 88
    assert result["reviewer_feedback"] == "Strong match with clear alignment to job requirements."
    assert result["iterations_run"] == 1
    assert result["draft_source"] == "fallback"
    assert "Dear Hiring Manager at Acme" in result["tailored_cover_letter"]


@pytest.mark.asyncio
async def test_feedback_falls_back_to_remaining_text(monkeypatch):
    fake_llm, _ = _make_fake_llm([DRAFT_JSON, "SCORE: 90\nAdd more keywords."])

    result = await _run(monkeypatch, fake_llm)

    assert result["reviewer_score"] == 90
    assert result["reviewer_feedback"] == "Add more keywords."
