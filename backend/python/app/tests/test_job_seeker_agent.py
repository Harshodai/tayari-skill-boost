import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from app.agent.job_seeker_agent import JobSeekerAgentEngine

@pytest.mark.asyncio
async def test_job_search(tmp_path):
    engine = JobSeekerAgentEngine(workspace_path=str(tmp_path))
    with patch.object(engine.engine.browser, "navigate", new_callable=AsyncMock, return_value={"success": True}):
        res = await engine.search_and_filter_jobs("Backend Developer", "Remote")
        assert res["total_found"] == 2
        assert "jobs" in res

@pytest.mark.asyncio
async def test_job_tailor(tmp_path):
    engine = JobSeekerAgentEngine(workspace_path=str(tmp_path))
    mock_repl_output = {
        "success": True,
        "stdout": "ATS Match Score: 80%\n",
        "stderr": "",
        "error": None
    }
    with patch.object(engine.engine.repl, "execute", new_callable=AsyncMock, return_value=mock_repl_output):
        res = await engine.tailor_resume_and_cover_letter("Python Architect", "Acme Inc", "Looking for Python, Kubernetes, CI/CD expertise")
        assert res["ats_match_score"] == 80
        assert res["cover_letter_file"] == "cover_letter_acme_inc.txt"

@pytest.mark.asyncio
async def test_auto_fill_form(tmp_path):
    engine = JobSeekerAgentEngine(workspace_path=str(tmp_path))
    profile = {"name": "Alex Mercer", "email": "alex@example.com"}
    with patch.object(engine.engine.browser, "navigate", new_callable=AsyncMock, return_value={"success": True}):
        res = await engine.auto_fill_application_form("https://boards.greenhouse.io/acme/jobs/123", profile)
        assert res["status"] == "simulated"
        assert len(res["actions_taken"]) >= 5

@pytest.mark.asyncio
async def test_interview_prep(tmp_path):
    engine = JobSeekerAgentEngine(workspace_path=str(tmp_path))
    res = await engine.generate_interview_prep_brief("Stripe")
    assert res["company"] == "Stripe"
    assert len(res["key_talking_points"]) >= 2
