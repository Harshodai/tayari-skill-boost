import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from app.agent.autonomous_career_engine import AutonomousCareerEngine
from app.agent.email_connector import EmailConnector
from app.agent.interview_board import InterviewBoardEngine

@pytest.mark.asyncio
async def test_email_connector():
    connector = EmailConnector()
    mock_reply = {
        "subject": "Thank you",
        "body": "Thank you for the interview invitation.",
        "type": "thank-you"
    }
    with patch("app.services.communication.CommunicationGenerator.generate", new_callable=AsyncMock, return_value=mock_reply):
        res = await connector.scan_inbox_for_interview_invites()
        assert res["invites_detected"] == 2
        assert "auto_reply_draft" in res["parsed_invites"][0]

def test_interview_board_engine():
    board = InterviewBoardEngine(enable_demo_cards=True)
    kanban = board.get_kanban_board()
    assert "TECHNICAL_INTERVIEW" in kanban
    assert len(kanban["TECHNICAL_INTERVIEW"]) >= 1

    update_res = board.update_card_stage("CARD-001", "BEHAVIORAL_SYSTEM_DESIGN")
    assert update_res["success"] is True
    assert update_res["card"]["stage"] == "BEHAVIORAL_SYSTEM_DESIGN"

@pytest.mark.asyncio
async def test_career_engine_email_and_board_sync():
    engine = AutonomousCareerEngine()
    mock_reply = {
        "subject": "Thank you",
        "body": "Thank you for the interview invitation.",
        "type": "thank-you"
    }
    with patch("app.services.communication.CommunicationGenerator.generate", new_callable=AsyncMock, return_value=mock_reply):
        sync_res = await engine.scan_and_sync_email_invites()
        assert len(sync_res["auto_synced_kanban_cards"]) == 2
        assert "APPLIED" in sync_res["current_kanban_board"]

@pytest.mark.asyncio
async def test_hitl_ats_optimization():
    engine = AutonomousCareerEngine()
    proposal = await engine.prepare_ats_keyword_optimization_hitl("Base resume text", "Python Kubernetes Distributed Systems")
    assert proposal["status"] == "PENDING_USER_APPROVAL"
    assert "approval_id" in proposal

    confirm_res = await engine.confirm_ats_keyword_optimization_hitl(proposal["approval_id"], approved=True)
    assert confirm_res["status"] == "APPROVED_AND_APPLIED"

@pytest.mark.asyncio
async def test_universal_batch_auto_apply():
    engine = AutonomousCareerEngine()
    urls = [
        "https://boards.greenhouse.io/acme/jobs/101",
        "https://jobs.lever.co/beta/jobs/202",
        "https://jobs.ashbyhq.com/gamma/303",
        "https://myworkdayjobs.com/delta/404",
        "https://bamboohr.com/epsilon/505"
    ]
    with patch("app.agent.browser_operator.BrowserOperator.navigate", new_callable=AsyncMock, return_value={"success": True}):
        res = await engine.universal_batch_auto_apply(urls, {"name": "Candidate"})
        assert res["total_processed"] == 5
        assert len(res["portals_covered"]) >= 4

@pytest.mark.asyncio
async def test_ai_salary_negotiation():
    engine = AutonomousCareerEngine()
    res = await engine.generate_ai_salary_negotiation(current_offer=200000, target_role="Staff Engineer", location="San Francisco, CA", company="OpenAI")
    assert res["target_counter_offer"] > 200000
    assert "OpenAI" in res["counter_offer_script"]
