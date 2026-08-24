import pytest
from unittest.mock import patch, AsyncMock

from app.api.voice_stream import generate_llm_response
from app.services.llm_service import LLMNotConfiguredError


@pytest.mark.asyncio
async def test_generate_llm_response_does_not_fabricate_on_failure():
    # ponytail: regression test for a real fabrication bug — this used to
    # catch every exception (including LLMNotConfiguredError) and return
    # "Thank you for that response. Let's move on to the next question.",
    # sent to the WebSocket client tagged type:"llm_text" — indistinguishable
    # from a real AI-generated interview question. It must now propagate.
    with patch("app.services.llm_service.llm_complete", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        with pytest.raises(LLMNotConfiguredError):
            await generate_llm_response("prompt", "system")


@pytest.mark.asyncio
async def test_generate_llm_response_returns_real_output_when_available():
    with patch("app.services.llm_service.llm_complete", new_callable=AsyncMock, return_value="What's your biggest technical challenge?"):
        res = await generate_llm_response("prompt", "system")
    assert res == "What's your biggest technical challenge?"
