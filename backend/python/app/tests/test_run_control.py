from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from app.services import run_control
from app.services.browser_automation import session as browser_session


class _Connection:
    def __init__(self, values: list[object] | None = None):
        self.values = list(values or [])
        self.calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchval(self, query: str, *args):
        self.calls.append((query, args))
        return self.values.pop(0) if self.values else None

    async def execute(self, query: str, *args):
        self.calls.append((query, args))
        return "UPDATE 1"

    async def fetchrow(self, query: str, *args):
        self.calls.append((query, args))
        return self.values.pop(0) if self.values else None

    async def fetch(self, query: str, *args):
        self.calls.append((query, args))
        return self.values.pop(0) if self.values else []


class _Pool:
    def __init__(self, connection: _Connection):
        self.connection = connection

    @asynccontextmanager
    async def acquire(self):
        yield self.connection


def test_cancellation_request_is_candidate_scoped_and_emits_a_durable_event(monkeypatch):
    connection = _Connection(["run-1"])
    events: list[tuple[str, str, str, dict]] = []

    async def fake_pool():
        return _Pool(connection)

    async def fake_emit(run_id, user_id, event_type, payload):
        events.append((run_id, user_id, event_type, payload))
        return True

    monkeypatch.setattr(run_control, "get_pool", fake_pool)
    monkeypatch.setattr(run_control, "emit_run_event", fake_emit)

    assert asyncio.run(run_control.request_cancellation("run-1", "candidate-1", "candidate clicked stop"))
    assert events == [
        ("run-1", "candidate-1", "cancellation_requested", {"reason": "candidate clicked stop"})
    ]
    query, args = connection.calls[0]
    assert "WHERE run_id = $1 AND user_id = $2" in query
    assert args[:2] == ("run-1", "candidate-1")


def test_worker_lease_rejects_missing_or_foreign_runs(monkeypatch):
    connection = _Connection([None])

    async def fake_pool():
        return _Pool(connection)

    monkeypatch.setattr(run_control, "get_pool", fake_pool)

    assert asyncio.run(run_control.acquire_worker_lease("missing-run", "candidate-1", "worker-a")) is None
    query, args = connection.calls[0]
    assert "WHERE run_id = $1 AND user_id = $2" in query
    assert args[:2] == ("missing-run", "candidate-1")


def test_control_snapshot_is_candidate_scoped_and_orders_bounded_events(monkeypatch):
    run = {
        "run_id": "run-1",
        "user_id": "candidate-1",
        "run_type": "application_agent",
        "status": "running",
        "progress": 42,
        "current_step": "filling application form",
        "cancellation_requested_at": None,
        "cancellation_reason": None,
        "cancellation_acknowledged_at": None,
        "worker_lease_expires_at": "2026-08-13T00:00:00Z",
    }
    newest_first_events = [
        {"sequence_no": 2, "event_type": "step_completed", "payload": {"step": "open portal"}, "created_at": "t2"},
        {"sequence_no": 1, "event_type": "run_started", "payload": {}, "created_at": "t1"},
    ]
    connection = _Connection([run, newest_first_events])

    async def fake_pool():
        return _Pool(connection)

    monkeypatch.setattr(run_control, "get_pool", fake_pool)
    snapshot = asyncio.run(run_control.get_run_control_snapshot("run-1", "candidate-1", event_limit=999))

    assert snapshot is not None
    assert snapshot["run_id"] == "run-1"
    assert [event["sequence_no"] for event in snapshot["events"]] == [1, 2]
    run_query, run_args = connection.calls[0]
    events_query, events_args = connection.calls[1]
    assert "WHERE ar.run_id = $1" in run_query
    assert run_args == ("run-1",)
    assert "WHERE run_id = $1 AND user_id = $2" in events_query
    assert events_args == ("run-1", "candidate-1", 200)


def test_control_snapshot_rejects_a_foreign_candidate(monkeypatch):
    connection = _Connection([{"run_id": "run-1", "user_id": "candidate-2"}])

    async def fake_pool():
        return _Pool(connection)

    monkeypatch.setattr(run_control, "get_pool", fake_pool)
    try:
        asyncio.run(run_control.get_run_control_snapshot("run-1", "candidate-1"))
    except run_control.RunControlOwnershipError:
        pass
    else:  # pragma: no cover - safety invariant
        raise AssertionError("a foreign candidate must not read a run control snapshot")


def test_live_browser_cancellation_persists_intent_then_acknowledges(monkeypatch):
    provider = browser_session.LocalPlaywrightProvider()
    browser_session._SESSIONS.clear()
    acknowledgements: list[tuple[str, str, str]] = []

    async def fake_request(run_id, user_id, reason="candidate_requested"):
        assert (run_id, user_id, reason) == ("run-1", "candidate-1", "candidate_requested")
        return True

    async def fake_acknowledge(run_id, user_id, outcome):
        acknowledgements.append((run_id, user_id, outcome))
        return True

    monkeypatch.setattr(browser_session, "get_provider", lambda: provider)
    import app.services.run_control as controls

    monkeypatch.setattr(controls, "request_cancellation", fake_request)
    monkeypatch.setattr(controls, "acknowledge_cancellation", fake_acknowledge)

    async def scenario():
        active = await browser_session.open_session("run-1", "candidate-1")
        assert browser_session.get_session("run-1") is active
        assert await browser_session.cancel_run("run-1", "candidate-1") is True
        assert browser_session.get_session("run-1") is None

    asyncio.run(scenario())
    assert acknowledgements == [("run-1", "candidate-1", "browser session terminated")]


def test_live_browser_cancellation_rejects_another_candidate(monkeypatch):
    provider = browser_session.LocalPlaywrightProvider()
    browser_session._SESSIONS.clear()
    monkeypatch.setattr(browser_session, "get_provider", lambda: provider)

    async def scenario():
        await browser_session.open_session("run-1", "candidate-1")
        try:
            await browser_session.cancel_run("run-1", "candidate-2")
        except browser_session.BrowserAuthzError:
            pass
        else:  # pragma: no cover - safety invariant
            raise AssertionError("foreign candidate must not terminate a live session")
        await browser_session.cancel_run("run-1", "candidate-1")

    asyncio.run(scenario())
