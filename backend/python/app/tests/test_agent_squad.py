"""Tests for the candidate-safe A2A review squad."""

import json

import pytest

from app.a2a import agent_squad
from app.a2a.agent_squad import AgentSquadOrchestrator


@pytest.mark.asyncio
async def test_squad_returns_review_package_and_never_enables_submission(monkeypatch):
    async def fake_optimizer(message):
        assert message.recipient == "OptimizerAgent"
        assert message.params["resume_text"] == "Built reliable Python services."
        return {
            "agent": "OptimizerAgent",
            "payload": {
                "optimized_text": "Built reliable Python services for distributed systems.",
                "changes": [{"kind": "clarity"}],
            },
        }

    async def fake_truth_gate(message):
        assert message.recipient == "TruthGateAgent"
        assert message.params["original_text"] == "Built reliable Python services."
        return {
            "agent": "TruthGateAgent",
            "payload": {"is_truthful": True, "risk_score": 0, "flags": []},
        }

    monkeypatch.setattr(agent_squad, "handle_optimizer_message", fake_optimizer)
    monkeypatch.setattr(agent_squad, "handle_truth_gate_message", fake_truth_gate)

    result = await AgentSquadOrchestrator().execute_squad_workflow(
        "Built reliable Python services.",
        "Need a Python engineer for distributed systems.",
        company="Example Corp",
        role="Backend Engineer",
    )

    assert result["status"] == "completed"
    assert result["agents_executed"] == ["OptimizerAgent", "TruthGateAgent"]
    assert result["candidate_approval_required"] is True
    assert result["submission_permitted"] is False
    assert result["external_submission_verified"] is False
    assert result["approval_scope"]["resume_sha256"]
    assert result["outputs"]["truth_gate"]["is_truthful"] is True

    audit_json = json.dumps(result["audit_events"])
    assert "Built reliable Python services." not in audit_json
    assert "Need a Python engineer" not in audit_json


@pytest.mark.asyncio
async def test_squad_fails_closed_when_optimizer_does_not_return_a_reviewable_artifact(monkeypatch):
    async def empty_optimizer(_message):
        return {"agent": "OptimizerAgent", "payload": {"changes": []}}

    monkeypatch.setattr(agent_squad, "handle_optimizer_message", empty_optimizer)

    result = await AgentSquadOrchestrator().execute_squad_workflow(
        "Original resume", "Target job description"
    )

    assert result["status"] == "failed"
    assert result["candidate_approval_required"] is True
    assert result["submission_permitted"] is False
    assert result["external_submission_verified"] is False
    assert result["outputs"] == {}


@pytest.mark.asyncio
async def test_squad_requires_resume_and_job_description():
    squad = AgentSquadOrchestrator()

    with pytest.raises(ValueError, match="resume_text is required"):
        await squad.execute_squad_workflow("", "Target job")

    with pytest.raises(ValueError, match="jd_text is required"):
        await squad.execute_squad_workflow("Original resume", "")
