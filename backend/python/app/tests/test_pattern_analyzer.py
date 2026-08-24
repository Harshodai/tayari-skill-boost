import pytest
from unittest.mock import patch, AsyncMock, MagicMock


def _mock_pool_with_rows(rows):
    conn = MagicMock()
    conn.fetch = AsyncMock(return_value=rows)

    class _Acquire:
        async def __aenter__(self):
            return conn

        async def __aexit__(self, *args):
            return False

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=_Acquire())
    return pool


@pytest.mark.asyncio
async def test_pattern_analyzer_does_not_fabricate_threshold_when_llm_unavailable():
    # ponytail: regression test for a real fabrication bug — this used to
    # return a specific, plausible-looking recommendation ("Maintain a
    # personal score floor of 4.0") as if it were derived from the
    # candidate's real application history, when the LLM synthesis call had
    # simply failed. The deterministic funnel/averages are real and must
    # still be returned; only the LLM-authored recommendation text must not
    # be fabricated.
    from app.services.pattern_analyzer import analyze_rejection_patterns

    rows = [
        {"stage": "rejected", "title": "Engineer", "company": "Acme", "location": "Remote",
         "dream_score": 3, "review_notes": "", "legitimacy_assessment": None, "evaluation_report": None},
    ]
    with patch("app.services.pattern_analyzer.get_pool", new_callable=AsyncMock, return_value=_mock_pool_with_rows(rows)), \
         patch("app.services.pattern_analyzer.llm_json", new_callable=AsyncMock, side_effect=RuntimeError("provider down")):
        res = await analyze_rejection_patterns("user-1")

    assert res["llm_available"] is False
    assert res["score_threshold_rationale"] is None
    assert res["recommendations"] == []
    assert res["total_analyzed"] == 1


@pytest.mark.asyncio
async def test_pattern_analyzer_uses_real_llm_synthesis_when_available():
    from app.services.pattern_analyzer import analyze_rejection_patterns

    rows = [
        {"stage": "interview", "title": "Engineer", "company": "Acme", "location": "Remote",
         "dream_score": 5, "review_notes": "", "legitimacy_assessment": None, "evaluation_report": None},
    ]
    fake_synthesis = {"score_threshold_rationale": "Real reasoning from this run.", "recommendations": [{"action": "a", "reasoning": "r", "impact": "High"}]}
    with patch("app.services.pattern_analyzer.get_pool", new_callable=AsyncMock, return_value=_mock_pool_with_rows(rows)), \
         patch("app.services.pattern_analyzer.llm_json", new_callable=AsyncMock, return_value=fake_synthesis):
        res = await analyze_rejection_patterns("user-1")

    assert res["llm_available"] is True
    assert res["score_threshold_rationale"] == "Real reasoning from this run."
    assert len(res["recommendations"]) == 1
