"""Regression coverage for AgentSpace's draft-only external-action boundary."""
from __future__ import annotations

from app.tasks import automation


def test_agentspace_task_returns_draft_without_external_submission(monkeypatch):
    """AgentSpace may prepare research, but must never manufacture a receipt."""
    import app.services.agent_db as agent_db
    import app.services.agent_router as agent_router

    events: list[tuple[str, str, str, dict | None]] = []
    task_updates: list[dict] = []
    attempt_updates: list[dict] = []

    async def fake_get_digital_employee(user_id: str, agent_id: str):
        return {"role": "Career Researcher", "instructions": "Find a suitable role."}

    async def fake_create_attempt(*args, **kwargs):
        return "attempt-1"

    async def fake_update_task_status(*args, **kwargs):
        task_updates.append(kwargs)

    async def fake_update_attempt(*args, **kwargs):
        attempt_updates.append(kwargs)

    async def fake_create_event(user_id, task_id, event_type, message, payload_json=None):
        events.append((task_id, event_type, message, payload_json))

    class FakeRouter:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        async def execute_agent_step(self, *args, **kwargs):
            return {"company": "Example Systems", "role": "Platform Engineer"}

        async def request_tool_execution(self, *args, **kwargs):  # pragma: no cover - must remain unreachable
            raise AssertionError("AgentSpace must not request or simulate final submission")

    monkeypatch.setattr(agent_db, "get_digital_employee", fake_get_digital_employee)
    monkeypatch.setattr(agent_db, "create_agent_task_attempt", fake_create_attempt)
    monkeypatch.setattr(agent_db, "update_agent_task_status", fake_update_task_status)
    monkeypatch.setattr(agent_db, "update_agent_task_attempt", fake_update_attempt)
    monkeypatch.setattr(agent_db, "create_agent_router_event", fake_create_event)
    monkeypatch.setattr(agent_router, "AgentRouter", FakeRouter)

    result = automation.run_agent_task.run("task-1", "user-1", "agent-1")

    assert result == {
        "task_id": "task-1",
        "status": "draft_ready",
        "submission_permitted": False,
    }
    assert task_updates[-1]["status"] == "success"
    payload = task_updates[-1]["result_json"]
    assert payload["status"] == "draft_ready"
    assert payload["submitted"] is False
    assert payload["submission_permitted"] is False
    assert payload["requires_candidate_approval"] is True
    assert payload["agent_output"]["company"] == "Example Systems"
    assert attempt_updates[-1]["status"] == "success"
    assert any(
        event_type == "task_success"
        and "No external application was submitted" in message
        and event_payload and event_payload["submitted"] is False
        for _, event_type, message, event_payload in events
    )


def test_agentspace_source_contains_no_simulated_submission_identity():
    """Guard against restoring placeholder company names or synthetic receipts."""
    source = open(automation.__file__, encoding="utf-8").read()

    assert '"Acme Corp"' not in source
    assert '"app_999"' not in source
    assert "Application submitted successfully!" not in source
    assert '"submission_permitted": False' in source
