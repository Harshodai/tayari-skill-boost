import pytest
from unittest.mock import patch

from app.llm.strategic_analyzer import StrategicAnalyzer
from app.services.llm_service import LLMNotConfiguredError


@pytest.mark.asyncio
async def test_analyze_hard_fails_when_truly_unconfigured():
    analyzer = StrategicAnalyzer()
    analyzer.llm_url = ""
    analyzer.llm_api_key = ""
    with pytest.raises(LLMNotConfiguredError):
        await analyzer.analyze("resume text", "jd text")


@pytest.mark.asyncio
async def test_analyze_fallback_honestly_labels_transient_failure_not_unconfigured():
    # ponytail: regression test — the fallback used to always say "No LLM
    # configured" even when the LLM WAS configured and a transient request
    # failure was the real cause, misleading about why generic guidance
    # appeared instead of real analysis.
    analyzer = StrategicAnalyzer()
    analyzer.llm_url = "https://example.test/v1/chat"
    analyzer.llm_api_key = "sk-configured"
    with patch.object(StrategicAnalyzer, "_llm_analysis", side_effect=RuntimeError("network blip")):
        res = await analyzer.analyze("resume text", "jd text")
    assert "LLM request failed" in res.strengths[0]
    assert "No LLM configured" not in res.strengths[0]
