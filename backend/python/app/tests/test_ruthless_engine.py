import pytest
import asyncio
from app.agent.ruthless_engine import RuthlessJobEngine

@pytest.mark.asyncio
async def test_stealth_ats_keyword_injection():
    engine = RuthlessJobEngine()
    res = await engine.inject_stealth_ats_keywords("Base Resume Text", "Distributed Systems Python Kubernetes")
    assert res["predicted_ats_score"] >= 95
    assert len(res["injected_keywords"]) >= 4

from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_batch_auto_apply():
    engine = RuthlessJobEngine()
    urls = [
        "https://boards.greenhouse.io/acme/jobs/101",
        "https://jobs.lever.co/beta/jobs/202"
    ]
    with patch.object(engine.agent.browser, "navigate", new_callable=AsyncMock, return_value={"success": True}):
        res = await engine.batch_auto_apply(urls, {"name": "Ruthless Candidate"})
        assert res["total_submitted"] == 2
        assert res["success_rate"] == "100%"

@pytest.mark.asyncio
async def test_recruiter_cold_outreach():
    engine = RuthlessJobEngine()
    res = await engine.generate_recruiter_cold_outreach("Stripe", "Sarah Jenkins", "Staff Backend Architect")
    assert len(res["email_sequence"]) == 2
    assert "Stripe" in res["email_sequence"][0]["content"]

@pytest.mark.asyncio
async def test_ruthless_salary_negotiation():
    engine = RuthlessJobEngine()
    res = await engine.generate_ruthless_salary_negotiation(current_offer=180000, target_percentile=90, company="OpenAI")
    assert res["counter_offer"] > 180000
    assert "OpenAI" in res["negotiation_email_script"]

@pytest.mark.asyncio
async def test_interview_copilot():
    engine = RuthlessJobEngine()
    res = await engine.generate_interview_copilot_response("Tell me about a time you handled API gateway latency.", "Principal Engineer")
    assert "STAR" in res["star_method_answer"] or "Situation" in res["star_method_answer"]
