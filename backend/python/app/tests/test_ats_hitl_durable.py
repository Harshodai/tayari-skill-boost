import pytest
from unittest.mock import patch, AsyncMock
from app.agent.autonomous_career_engine import AutonomousCareerEngine
from fastapi.testclient import TestClient
from app.main import app
from app.auth.dependencies import get_current_user

MOCK_OPTIMIZER_OUTPUT = {
    "optimized_text": "Senior Full Stack Engineer with extensive Python and Go experience.",
    "keywords_added": ["PostgreSQL", "Docker"],
    "new_heuristic_score": 85,
    "semantic_similarity_before": {"score": 60},
    "optimization_summary": {"changes": 2},
    "alignment_report": {},
}

@pytest.mark.asyncio
async def test_ats_hitl_proposal_creates_hash_binding():
    engine = AutonomousCareerEngine(user_id="00000000-0000-0000-0000-000000000001")
    resume = "Senior Full Stack Engineer with 7 years Python and Go experience."
    jd = "Seeking Senior Full Stack Engineer with Python, Go, and PostgreSQL experience."
    
    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT), \
         patch("app.services.agent_db.create_runtime_approval", new_callable=AsyncMock, return_value="app-111"), \
         patch("app.services.agent_db.update_runtime_approval", new_callable=AsyncMock, return_value=True):
        proposal = await engine.prepare_ats_keyword_optimization_hitl(resume, jd)
    
        assert proposal["status"] == "PENDING_USER_APPROVAL"
        assert proposal["approval_id"].startswith("HITL-ATS-")
        assert len(proposal["proposal_hash"]) == 64
        assert len(proposal["resume_hash"]) == 64
        assert len(proposal["jd_hash"]) == 64

        # Confirm with valid expected proposal hash
        confirm_res = await engine.confirm_ats_keyword_optimization_hitl(
            proposal["approval_id"],
            approved=True,
            expected_proposal_hash=proposal["proposal_hash"],
        )
        assert confirm_res["success"] is True
        assert confirm_res["status"] == "APPROVED_AND_READY"


@pytest.mark.asyncio
async def test_ats_hitl_rejects_hash_tampering():
    engine = AutonomousCareerEngine(user_id="00000000-0000-0000-0000-000000000001")
    resume = "Data Engineer with Spark and Kafka experience."
    jd = "Data Engineer needed with Spark, Kafka, and Snowflake."
    
    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT), \
         patch("app.services.agent_db.create_runtime_approval", new_callable=AsyncMock, return_value="app-111"), \
         patch("app.services.agent_db.update_runtime_approval", new_callable=AsyncMock, return_value=True):
        proposal = await engine.prepare_ats_keyword_optimization_hitl(resume, jd)
    
        # Attempt to confirm with a modified/tampered proposal hash
        tampered_hash = "0" * 64
        confirm_res = await engine.confirm_ats_keyword_optimization_hitl(
            proposal["approval_id"],
            approved=True,
            expected_proposal_hash=tampered_hash,
        )
        assert confirm_res["success"] is False
        assert "mismatch" in confirm_res["error"].lower()


@pytest.mark.asyncio
async def test_ats_hitl_rejects_different_user():
    engine_user_a = AutonomousCareerEngine(user_id="00000000-0000-0000-0000-000000000001")
    engine_user_b = AutonomousCareerEngine(user_id="00000000-0000-0000-0000-000000000002")

    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT), \
         patch("app.services.agent_db.create_runtime_approval", new_callable=AsyncMock, return_value="app-111"), \
         patch("app.services.agent_db.update_runtime_approval", new_callable=AsyncMock, return_value=True), \
         patch("app.services.agent_db.list_runtime_approvals", new_callable=AsyncMock, return_value=[]):
        proposal = await engine_user_a.prepare_ats_keyword_optimization_hitl("Resume A", "JD A")

        # User B attempts to approve User A's proposal
        confirm_res = await engine_user_b.confirm_ats_keyword_optimization_hitl(
            proposal["approval_id"],
            approved=True,
            expected_proposal_hash=proposal["proposal_hash"],
        )
        assert confirm_res["success"] is False


@pytest.mark.asyncio
async def test_ats_hitl_rejects_repeated_decision():
    engine = AutonomousCareerEngine(user_id="00000000-0000-0000-0000-000000000001")

    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT), \
         patch("app.services.agent_db.create_runtime_approval", new_callable=AsyncMock, return_value="app-111"), \
         patch("app.services.agent_db.update_runtime_approval", new_callable=AsyncMock, return_value=True):
        proposal = await engine.prepare_ats_keyword_optimization_hitl("Resume text", "JD text")

        # First approval succeeds
        confirm_res1 = await engine.confirm_ats_keyword_optimization_hitl(
            proposal["approval_id"],
            approved=True,
            expected_proposal_hash=proposal["proposal_hash"],
        )
        assert confirm_res1["success"] is True

        # Subsequent approval or rejection fails because it is no longer pending
        confirm_res2 = await engine.confirm_ats_keyword_optimization_hitl(
            proposal["approval_id"],
            approved=False,
            expected_proposal_hash=proposal["proposal_hash"],
        )
        assert confirm_res2["success"] is False
        assert "not found" in confirm_res2["error"].lower() or "not in pending state" in confirm_res2["error"].lower()


@pytest.mark.asyncio
async def test_ats_hitl_persistence_failure_cleans_global_cache():
    engine = AutonomousCareerEngine(user_id="00000000-0000-0000-0000-000000000001")

    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT), \
         patch("app.services.agent_db.create_runtime_approval", new_callable=AsyncMock, return_value=None):
        with pytest.raises(RuntimeError, match="Failed to persist HITL approval to durable storage"):
            await engine.prepare_ats_keyword_optimization_hitl("Resume text", "JD text")

    # Verify no leaked pending approvals in memory or global cache
    assert len(engine.pending_hitl_approvals) == 0


@pytest.mark.asyncio
async def test_ats_hitl_unscoped_caller_cannot_access_user_scoped_cache():
    engine_scoped = AutonomousCareerEngine(user_id="00000000-0000-0000-0000-000000000001")
    engine_unscoped = AutonomousCareerEngine(user_id=None)

    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT), \
         patch("app.services.agent_db.create_runtime_approval", new_callable=AsyncMock, return_value="app-111"):
        proposal = await engine_scoped.prepare_ats_keyword_optimization_hitl("Resume text", "JD text")

    # Unscoped engine (effective_user_id=None) tries to access User 1's cached approval
    confirm_res = await engine_unscoped.confirm_ats_keyword_optimization_hitl(
        proposal["approval_id"],
        approved=True,
        expected_proposal_hash=proposal["proposal_hash"],
    )
    assert confirm_res["success"] is False
    assert "not found" in confirm_res["error"].lower()


def test_ats_prepare_route_returns_503_on_persistence_failure():
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: "00000000-0000-0000-0000-000000000001"
    try:
        with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT), \
             patch("app.services.agent_db.create_runtime_approval", new_callable=AsyncMock, return_value=None):
            response = client.post(
                "/api/v1/ai/agent/career/ats-prepare",
                json={"resume_text": "My resume", "job_description": "My job description"},
            )
            assert response.status_code == 503
            assert "Failed to persist HITL approval" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
