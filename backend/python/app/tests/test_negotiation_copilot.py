import pytest
from unittest.mock import patch, AsyncMock

from app.services.negotiation_copilot import generate_negotiation_strategy, NegotiationDraft
from app.services.llm_service import LLMNotConfiguredError


@pytest.mark.asyncio
async def test_negotiation_no_fabrication_when_llm_unconfigured():
    # ponytail: regression test for a real fabrication bug — this used to call
    # the LLM as an "elite executive salary negotiation coach", discard its
    # real response into an unused "ai_guidance" field, and always serve
    # identical hardcoded negotiation emails/script regardless of LLM state.
    # The benchmark/counter-offer numbers are real math and must survive even
    # when the LLM is unavailable; only the drafted prose must not fabricate.
    with patch("app.services.negotiation_copilot.llm_json", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        res = await generate_negotiation_strategy(
            role="Senior Software Engineer", company="Acme", base_offer=180000, equity_offer=50000,
        )
    assert res["llm_available"] is False
    assert res["emails"] is None
    assert res["verbal_script"] is None
    assert res["recommended_counter"]["base"] > 180000
    assert res["market_benchmark"]["base"] == 185000


@pytest.mark.asyncio
async def test_negotiation_uses_real_llm_draft_when_available():
    draft = NegotiationDraft(
        warm_appreciation_email="Dear Hiring Team, thank you for the offer...",
        data_backed_email="Dear Hiring Manager, based on market benchmarks...",
        verbal_script="Hi, thanks for the offer, I'd like to discuss compensation...",
    )
    with patch("app.services.negotiation_copilot.llm_json", new_callable=AsyncMock, return_value=draft):
        res = await generate_negotiation_strategy(
            role="Senior Software Engineer", company="Acme", base_offer=180000, equity_offer=50000,
        )
    assert res["llm_available"] is True
    assert res["emails"]["warm_appreciation"] == draft.warm_appreciation_email
    assert res["emails"]["data_backed"] == draft.data_backed_email
    assert res["verbal_script"] == draft.verbal_script
