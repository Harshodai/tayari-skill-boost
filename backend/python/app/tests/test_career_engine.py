import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from app.agent.autonomous_career_engine import AutonomousCareerEngine
from app.agent.email_connector import EmailConnector
from app.agent.interview_board import InterviewBoardEngine
from app.services.llm_service import LLMNotConfiguredError

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
    optimizer_result = {
        "optimized_text": "Candidate\n\nEXPERIENCE\n- Built Python services",
        "keywords_added": ["Python", "Kubernetes"],
        "new_heuristic_score": 82,
        "semantic_similarity_before": {"score": 0.31},
        "keyword_matrix": {},
        "optimization_summary": {"heuristic_score_after": 82},
        "alignment_report": {"is_aligned": True},
    }
    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", new_callable=AsyncMock, return_value=optimizer_result):
        proposal = await engine.prepare_ats_keyword_optimization_hitl("Base resume text", "Python Kubernetes Distributed Systems")

    assert proposal["status"] == "PENDING_USER_APPROVAL"
    assert proposal["is_sample_data"] is False
    assert proposal["extracted_keywords"] == ["Python", "Kubernetes"]
    assert proposal["predicted_ats_score_after"] == 82
    assert "approval_id" in proposal

    confirm_res = await engine.confirm_ats_keyword_optimization_hitl(
        proposal["approval_id"],
        approved=True,
        expected_proposal_hash=proposal["proposal_hash"],
    )
    assert confirm_res["status"] == "APPROVED_AND_READY"
    assert confirm_res["optimized_text"].startswith("Candidate")

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
    form_result = {"success": True, "needs_human": False, "questions_queued": 0, "actions_executed": ["Filled email"]}
    with patch("app.agent.autonomous_career_engine.FormFiller.execute_form_auto_fill", new_callable=AsyncMock, return_value=form_result), \
         patch("app.agent.autonomous_career_engine.FormFiller.close", new_callable=AsyncMock):
        res = await engine.universal_batch_auto_apply(urls, {"name": "Candidate"}, user_id="user-123")

    assert res["total_processed"] == 5
    assert res["total_prepared"] == 5
    assert res["submitted"] is False
    assert len(res["portals_covered"]) >= 4
    assert all(item["status"] == "FORM_PREPARED" for item in res["applications"])

@pytest.mark.asyncio
async def test_ai_salary_negotiation():
    engine = AutonomousCareerEngine()
    # ponytail: with no LLM configured the engine must NOT fabricate a counter-offer;
    # it signals unavailability and leaves derived outputs absent so callers can 503.
    with patch("app.agent.autonomous_career_engine.llm_complete", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        res = await engine.generate_ai_salary_negotiation(current_offer=200000, target_role="Staff Engineer", location="San Francisco, CA", company="OpenAI")
        assert res["llm_available"] is False
        assert res["target_counter_offer"] is None
        assert res["counter_offer_script"] is None

    # When the LLM is available, the counter-offer and script are produced.
    with patch("app.agent.autonomous_career_engine.llm_complete", new_callable=AsyncMock, return_value="Counter at $240,000 based on benchmarks."):
        res = await engine.generate_ai_salary_negotiation(current_offer=200000, target_role="Staff Engineer", location="San Francisco, CA", company="OpenAI")
    assert res["llm_available"] is True
    assert res["target_counter_offer"] > 200000
    assert "OpenAI" in res["counter_offer_script"]

@pytest.mark.asyncio
async def test_recruiter_cold_outreach_no_fabrication_when_unconfigured():
    engine = AutonomousCareerEngine()
    # ponytail: regression test for a real fabrication bug — this method used
    # to return a hardcoded static template ("Having led engineering
    # initiatives in high-scale systems...") for every candidate/company/role
    # regardless of LLM availability, presented as an AI-drafted email. It must
    # now be honest: no LLM configured -> no draft, explicit llm_available flag.
    with patch("app.agent.autonomous_career_engine.llm_complete", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        res = await engine.generate_recruiter_cold_outreach(company="Acme", recruiter_name="Jane", job_title="Senior Engineer")
        assert res["llm_available"] is False
        assert res["sequence"] == []

    with patch("app.agent.autonomous_career_engine.llm_complete", new_callable=AsyncMock, return_value="Subject: Senior Engineer at Acme\n\nHi Jane, ..."):
        res = await engine.generate_recruiter_cold_outreach(company="Acme", recruiter_name="Jane", job_title="Senior Engineer")
    assert res["llm_available"] is True
    assert res["sequence"][0]["email"].startswith("Subject:")

@pytest.mark.asyncio
async def test_interview_copilot_does_not_fabricate_on_provider_error():
    engine = AutonomousCareerEngine()
    # ponytail: regression test for a real fabrication bug — a bare
    # `except Exception` used to return a canned generic STAR answer for ANY
    # provider failure (timeout, rate limit, malformed response), not just a
    # missing configuration. Both failure modes must now propagate honestly.
    with patch("app.agent.autonomous_career_engine.llm_complete", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        with pytest.raises(LLMNotConfiguredError):
            await engine.generate_interview_copilot_response("Tell me about a time you failed.", "Senior Engineer")

    with patch("app.agent.autonomous_career_engine.llm_complete", new_callable=AsyncMock, side_effect=TimeoutError("provider timed out")):
        with pytest.raises(TimeoutError):
            await engine.generate_interview_copilot_response("Tell me about a time you failed.", "Senior Engineer")

    with patch("app.agent.autonomous_career_engine.llm_complete", new_callable=AsyncMock, return_value="**Situation**: ..."):
        res = await engine.generate_interview_copilot_response("Tell me about a time you failed.", "Senior Engineer")
    assert res["star_answer"] == "**Situation**: ..."
