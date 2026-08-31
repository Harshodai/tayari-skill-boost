import pytest
from unittest.mock import patch
from app.agent.autonomous_career_engine import AutonomousCareerEngine

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
    
    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT):
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
    
    with patch("app.agent.autonomous_career_engine.optimize_with_reflection", return_value=MOCK_OPTIMIZER_OUTPUT):
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
