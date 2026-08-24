"""Tests for the Moat-2 live copilot: stream generator, hint, voice analysis.

Pure tests: llm_complete is monkeypatched; nothing network-bound.

ponytail: these mocks used to be defined as `(prompt, system_prompt=None)`,
matching a wrong call the production code was making
(llm_complete(prompt=..., system_prompt=...) against a real function whose
actual params are system_message/user_message) -- the tests were certifying
a live production bug (a permanent TypeError, masked by a bare `except
Exception` that fabricated fallback content on every single call) as correct
behavior instead of catching it. Fixed to match the real signature.
"""
import pytest

pytest.importorskip("pydantic")

from app.services.live_interview_copilot import (
    CopilotHintRequest,
    LiveCopilotRequest,
    VoiceAnalysisRequest,
    analyze_candidate_speech,
    generate_interview_hint,
    stream_live_copilot_hints,
)
from app.services.llm_service import LLMNotConfiguredError

MODULE = "app.services.live_interview_copilot"


def _req():
    return LiveCopilotRequest(
        interviewer_transcript="Describe a challenging project you delivered.",
        job_title="Senior Backend Engineer",
        company_name="Acme",
        target_skills=["Go", "Postgres"],
    )


@pytest.mark.asyncio
async def test_stream_yields_progressive_events(monkeypatch):
    async def fake_llm_complete(system_message, user_message):
        return (
            '{"detected_question_type":"Behavioral","instant_hints":["Hint A"],'
            '"star_framework":{"situation":"S","task":"T","action":"A","result":"R"},'
            '"suggested_metrics":["Reduced latency 45%"]}'
        )

    monkeypatch.setattr(f"{MODULE}.llm_complete", fake_llm_complete)

    events = [e async for e in stream_live_copilot_hints(_req())]
    types = [e["type"] for e in events]
    assert types == ["question_type", "hints", "star", "metrics", "done"]
    assert events[0]["value"] == "Behavioral"
    assert events[1]["value"] == ["Hint A"]
    assert events[3]["value"] == ["Reduced latency 45%"]


@pytest.mark.asyncio
async def test_stream_emits_error_event_on_unconfigured_llm(monkeypatch):
    async def raise_unconfigured(system_message, user_message):
        raise LLMNotConfiguredError("no LLM")

    monkeypatch.setattr(f"{MODULE}.llm_complete", raise_unconfigured)

    events = [e async for e in stream_live_copilot_hints(_req())]
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert events[0]["error"] == "ai_service_unavailable"


@pytest.mark.asyncio
async def test_stream_emits_error_event_on_invalid_llm_output(monkeypatch):
    async def fake_llm_complete(system_message, user_message):
        return "not json at all"

    monkeypatch.setattr(f"{MODULE}.llm_complete", fake_llm_complete)

    events = [e async for e in stream_live_copilot_hints(_req())]
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert events[0]["error"] == "llm_output_invalid"


@pytest.mark.asyncio
async def test_generate_interview_hint_maps_target_role(monkeypatch):
    async def fake_llm_complete(system_message, user_message):
        return '{"detected_question_type":"Technical","instant_hints":["H"],"star_framework":{},"suggested_metrics":[]}'

    monkeypatch.setattr(f"{MODULE}.llm_complete", fake_llm_complete)

    res = await generate_interview_hint(
        CopilotHintRequest(interviewer_transcript="What is a cache stampede?", target_role="Staff Engineer")
    )
    assert res.detected_question_type == "Technical"


def test_analyze_candidate_speech_deterministic():
    res = analyze_candidate_speech(
        VoiceAnalysisRequest(
            transcript="I built a payments service and reduced latency by 40 percent. Um, like, we needed to scale.",
            duration_seconds=30,
        )
    )
    assert res.wpm > 0
    assert res.filler_word_count >= 2
    assert res.star_breakdown["result"] == "Present"
    assert res.coaching_tips


def test_analyze_candidate_speech_empty_transcript():
    res = analyze_candidate_speech(VoiceAnalysisRequest(transcript="", duration_seconds=15))
    assert res.wpm == 0
    assert res.wpm_status == "no speech detected"
    assert res.filler_word_count == 0