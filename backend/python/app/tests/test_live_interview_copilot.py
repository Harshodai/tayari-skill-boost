import pytest
from unittest.mock import patch

from app.services.live_interview_copilot import generate_live_copilot_hints, LiveCopilotRequest
from app.services.llm_service import LLMNotConfiguredError


@pytest.mark.asyncio
async def test_live_copilot_does_not_fabricate_on_provider_unconfigured():
    # ponytail: regression test for a real fabrication bug — a bare
    # `except Exception` used to swallow LLMNotConfiguredError (and every
    # other failure) and return a fully invented STAR hint set with fake
    # specific metrics ("Increased performance by 35%") as if the LLM had
    # produced it, making the route's LLMNotConfiguredError -> 503 handler
    # unreachable. Both failure modes must now propagate.
    req = LiveCopilotRequest(interviewer_transcript="Tell me about a challenge you overcame.")
    with patch("app.services.live_interview_copilot.llm_complete", autospec=True, side_effect=LLMNotConfiguredError("unconfigured")):
        with pytest.raises(LLMNotConfiguredError):
            await generate_live_copilot_hints(req)


@pytest.mark.asyncio
async def test_live_copilot_does_not_fabricate_on_provider_timeout():
    req = LiveCopilotRequest(interviewer_transcript="Tell me about a challenge you overcame.")
    with patch("app.services.live_interview_copilot.llm_complete", autospec=True, side_effect=TimeoutError("provider timed out")):
        with pytest.raises(TimeoutError):
            await generate_live_copilot_hints(req)


@pytest.mark.asyncio
async def test_live_copilot_returns_real_llm_output_when_available():
    req = LiveCopilotRequest(interviewer_transcript="Tell me about a challenge you overcame.")
    fake_json = '{"detected_question_type": "Behavioral", "instant_hints": ["Be specific"], "star_framework": {"situation": "s", "task": "t", "action": "a", "result": "r"}, "suggested_metrics": ["Real metric from this run"]}'
    # ponytail: autospec=True (not a bare AsyncMock) validates the call
    # against llm_complete's real signature — this caught a real production
    # bug: generate_live_copilot_hints called llm_complete(prompt=...,
    # system_prompt=...), keyword args that don't exist on the real function
    # (system_message/user_message). The mismatch always raised TypeError in
    # production, invisible because the caller's bare `except Exception`
    # (fixed above) swallowed it into fabricated content every time. A plain
    # AsyncMock accepts any kwargs silently and would never have caught this.
    with patch("app.services.live_interview_copilot.llm_complete", autospec=True, return_value=fake_json):
        res = await generate_live_copilot_hints(req)
    assert res.detected_question_type == "Behavioral"
    assert res.suggested_metrics == ["Real metric from this run"]
