from __future__ import annotations

import pytest

from app.services.capabilities import Capability
from app.tasks.agent_automation import action_hash, token_digest


def test_action_hash_is_stable_and_payload_bound():
    first = action_hash("draft_email", "external_write", "Review", {"body": "one"}, "v1")
    same = action_hash("draft_email", "external_write", "Review", {"body": "one"}, "v1")
    changed = action_hash("draft_email", "external_write", "Review", {"body": "two"}, "v1")
    assert first == same
    assert first != changed
    assert len(first) == 64


def test_token_digest_is_not_the_raw_token():
    token = "a" * 64
    digest = token_digest(token)
    assert digest != token
    assert len(digest) == 64


def test_submission_is_not_an_automation_risk_path():
    assert Capability.AUTONOMOUS_ATS_SUBMIT.value == "autonomous.ats_submit"


@pytest.mark.asyncio
async def test_dispatch_is_disabled_in_production_without_capability(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CAPABILITY_WORKSPACE_AUTOMATIONS", raising=False)
    from app.tasks import agent_automation

    result = await agent_automation._dispatch()
    assert result == {"status": "disabled_by_launch_scope", "expired": 0, "reclaimed": 0, "claimed": 0}


class _AutomationConn:
    def __init__(self, reclaimed=None, heartbeat_result=None):
        self.reclaimed = reclaimed or []
        self.heartbeat_result = heartbeat_result
        self.fetch_calls = []
        self.fetchval_calls = []
        self.execute_calls = []

    async def fetch(self, query, *args):
        self.fetch_calls.append((query, args))
        return self.reclaimed

    async def fetchval(self, query, *args):
        self.fetchval_calls.append((query, args))
        return self.heartbeat_result

    async def execute(self, query, *args):
        self.execute_calls.append((query, args))


@pytest.mark.asyncio
async def test_reclaim_expired_runs_records_worker_reclaim_event(monkeypatch):
    from app.tasks import agent_automation

    worker_id = __import__("uuid").UUID("11111111-1111-1111-1111-111111111111")
    run = {
        "id": "run-1",
        "definition_id": "definition-1",
        "tenant_id": "tenant-1",
        "user_id": "user-1",
        "status": "running",
        "version": 4,
        "lease_owner": worker_id,
        "reclaim_count": 2,
    }
    conn = _AutomationConn(reclaimed=[run])
    monkeypatch.setattr(agent_automation, "_lease_deadline", lambda: agent_automation._utcnow())

    reclaimed = await agent_automation._reclaim_expired_runs(conn, worker_id)

    assert reclaimed == [run]
    assert conn.fetch_calls
    query, args = conn.fetch_calls[0]
    assert "reclaim_count=run.reclaim_count+1" in query
    assert args[0] == worker_id
    assert any("automation.run.reclaimed" in query_args for _, query_args in conn.execute_calls)


@pytest.mark.asyncio
async def test_heartbeat_fails_closed_when_worker_no_longer_owns_run():
    from app.tasks import agent_automation

    worker_id = __import__("uuid").UUID("22222222-2222-2222-2222-222222222222")
    conn = _AutomationConn(heartbeat_result=None)
    run = {"id": "run-2", "tenant_id": "tenant-1", "user_id": "user-1"}

    with pytest.raises(RuntimeError, match="lease lost"):
        await agent_automation._heartbeat_run(conn, run, worker_id)

    assert conn.fetchval_calls
    assert "lease_owner=$5" in conn.fetchval_calls[0][0]
