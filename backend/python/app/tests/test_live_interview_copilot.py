import pytest
from unittest.mock import patch, AsyncMock

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
    with patch("app.services.live_interview_copilot.llm_complete", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        with pytest.raises(LLMNotConfiguredError):
            await generate_live_copilot_hints(req)


@pytest.mark.asyncio
async def test_live_copilot_does_not_fabricate_on_provider_timeout():
    req = LiveCopilotRequest(interviewer_transcript="Tell me about a challenge you overcame.")
    with patch("app.services.live_interview_copilot.llm_complete", new_callable=AsyncMock, side_effect=TimeoutError("provider timed out")):
        with pytest.raises(TimeoutError):
            await generate_live_copilot_hints(req)


@pytest.mark.asyncio
async def test_live_copilot_returns_real_llm_output_when_available():
    req = LiveCopilotRequest(interviewer_transcript="Tell me about a challenge you overcame.")
    fake_json = '{"detected_question_type": "Behavioral", "instant_hints": ["Be specific"], "star_framework": {"situation": "s", "task": "t", "action": "a", "result": "r"}, "suggested_metrics": ["Real metric from this run"]}'
    with patch("app.services.live_interview_copilot.llm_complete", new_callable=AsyncMock, return_value=fake_json):
        res = await generate_live_copilot_hints(req)
    assert res.detected_question_type == "Behavioral"
    assert res.suggested_metrics == ["Real metric from this run"]
