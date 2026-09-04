import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest
from app.services import computer_replay
from app.services.browser_worker_pool import BrowserWorker

@pytest.mark.asyncio
async def test_replay_returns_events_after_cursor():
    class FakeRedis:
        def __init__(self): self.data = []
        async def lrange(self, k, a, b): return self.data[a:b+1]
    out = await computer_replay.replay_computer_events("r1", after=3, _client=FakeRedis())
    assert out["next_after"] == 3
    assert out["events"] == []


class FakeRedisList:
    def __init__(self):
        self.store = {}
        self.calls = []

    async def rpush(self, k, v):
        self.calls.append(("rpush", k))
        self.store.setdefault(k, []).append(v)

    async def ltrim(self, k, a, b):
        self.calls.append(("ltrim", k, a, b))
        vals = self.store.get(k, [])
        n = len(vals)
        sa = a if a >= 0 else max(0, n + a)
        sb = b if b >= 0 else n + b
        self.store[k] = vals[sa:sb + 1]

    async def expire(self, k, ttl):
        self.calls.append(("expire", k, ttl))

    async def lrange(self, k, a, b):
        vals = self.store.get(k, [])
        return vals[a:b + 1]


@pytest.mark.asyncio
async def test_append_then_replay_filters_after_and_advances_next_after():
    client = FakeRedisList()
    await computer_replay.append_computer_event("r1", {"step_index": 1, "type": "a"}, _client=client)
    await computer_replay.append_computer_event("r1", {"step_index": 2, "type": "b"}, _client=client)
    await computer_replay.append_computer_event("r1", {"step_index": 3, "type": "c"}, _client=client)
    out = await computer_replay.replay_computer_events("r1", after=1, _client=client)
    assert [e["step_index"] for e in out["events"]] == [2, 3]
    assert out["next_after"] == 3


@pytest.mark.asyncio
async def test_append_caps_list_to_last_500():
    client = FakeRedisList()
    for i in range(1, 504):
        await computer_replay.append_computer_event("r1", {"step_index": i}, _client=client)
    key = computer_replay.replay_key("r1")
    assert len(client.store[key]) == 500
    assert json.loads(client.store[key][0])["step_index"] == 4
    ltrims = [c for c in client.calls if c[0] == "ltrim"]
    assert ltrims and ltrims[0][2:] == (-500, -1)


@pytest.mark.asyncio
async def test_append_sets_ttl_86400():
    client = FakeRedisList()
    await computer_replay.append_computer_event("r1", {"step_index": 1}, _client=client)
    expires = [c for c in client.calls if c[0] == "expire"]
    assert (computer_replay.replay_key("r1"), 86400) == (expires[0][1], expires[0][2])


@pytest.mark.asyncio
async def test_replay_fail_open_when_client_none(monkeypatch):
    monkeypatch.setattr("app.services.llm_cache.get_redis_client", lambda: None)
    await computer_replay.append_computer_event("r1", {"step_index": 1})
    out = await computer_replay.replay_computer_events("r1", after=5)
    assert out == {"events": [], "next_after": 5}


@pytest.mark.asyncio
async def test_replay_fail_open_when_client_raises():
    class BoomRedis:
        async def rpush(self, *a, **k): raise RuntimeError("down")
        async def ltrim(self, *a, **k): raise RuntimeError("down")
        async def expire(self, *a, **k): raise RuntimeError("down")
        async def lrange(self, *a, **k): raise RuntimeError("down")
    await computer_replay.append_computer_event("r1", {"step_index": 1}, _client=BoomRedis())
    out = await computer_replay.replay_computer_events("r1", after=2, _client=BoomRedis())
    assert out == {"events": [], "next_after": 2}


@pytest.mark.asyncio
async def test_replay_route_returns_cursor_shape(monkeypatch):
    import app.api.computer_routes as cr
    from app.auth.dependencies import VerifiedRequestContext
    import app.services.browser_worker_pool as pool
    monkeypatch.setattr(pool, "get_worker", lambda rid: None)
    async def fake_replay(run_id, after=0, limit=500, _client=None, user_id=""):
        assert user_id == "owner-a"
        return {"events": [], "next_after": after}
    monkeypatch.setattr(cr, "replay_computer_events", fake_replay)
    ctx = VerifiedRequestContext(subject="owner-a", tenant_id="00000000-0000-0000-0000-000000000000")
    out = await cr.replay_run_events(run_id="r1", after=0, context=ctx)
    assert out["next_after"] == 0
    assert out["events"] == []


@pytest.mark.asyncio
async def test_replay_forbids_active_worker_owned_by_other_user(monkeypatch):
    import app.api.computer_routes as cr
    from app.auth.dependencies import VerifiedRequestContext
    from app.services.browser_worker_pool import BrowserWorker
    from fastapi import HTTPException
    worker = BrowserWorker(run_id="r1", user_id="owner-a", target_url="https://boards.greenhouse.io/a/b")
    import app.services.browser_worker_pool as pool
    monkeypatch.setattr(pool, "get_worker", lambda rid: worker)
    ctx = VerifiedRequestContext(subject="owner-b", tenant_id="00000000-0000-0000-0000-000000000000")
    try:
        await cr.replay_run_events(run_id="r1", after=0, context=ctx)
        assert False, "expected 403"
    except HTTPException as exc:
        assert exc.status_code == 403


@pytest.mark.asyncio
async def test_replay_allows_owner_and_clamps_negative_after(monkeypatch):
    import app.api.computer_routes as cr
    from app.auth.dependencies import VerifiedRequestContext
    from app.services.browser_worker_pool import BrowserWorker
    worker = BrowserWorker(run_id="r1", user_id="owner-a", target_url="https://boards.greenhouse.io/a/b")
    import app.services.browser_worker_pool as pool
    monkeypatch.setattr(pool, "get_worker", lambda rid: worker)
    seen = {}
    async def fake_replay(run_id, after=0, limit=500, _client=None, user_id=""):
        seen["after"] = after
        seen["user_id"] = user_id
        return {"events": [], "next_after": after}
    monkeypatch.setattr(cr, "replay_computer_events", fake_replay)
    ctx = VerifiedRequestContext(subject="owner-a", tenant_id="00000000-0000-0000-0000-000000000000")
    out = await cr.replay_run_events(run_id="r1", after=-5, context=ctx)
    assert out == {"events": [], "next_after": 0}
    assert seen["after"] == 0
    assert seen["user_id"] == "owner-a"


@pytest.mark.asyncio
async def test_replay_keys_are_owner_scoped():
    client = FakeRedisList()
    await computer_replay.append_computer_event("r1", {"step_index": 1, "type": "a"}, _client=client, user_id="owner-a")
    other = await computer_replay.replay_computer_events("r1", after=0, _client=client, user_id="owner-b")
    assert other["events"] == []
    own = await computer_replay.replay_computer_events("r1", after=0, _client=client, user_id="owner-a")
    assert [e["step_index"] for e in own["events"]] == [1]


@pytest.mark.asyncio
async def test_emit_event_hook_calls_append_without_blocking_worker_loop():
    worker = BrowserWorker(run_id="r1", user_id="u1", target_url="https://boards.greenhouse.io/a/b")
    with patch("app.services.computer_replay.append_computer_event", new=AsyncMock()) as mock_append:
        event = worker.emit_event("action", {"action": "navigate"})
        assert worker.events and worker.events[-1] == event
        for _ in range(20):
            await asyncio.sleep(0)
            if mock_append.await_count:
                break
        assert mock_append.await_count == 1
        assert mock_append.await_args.args[0] == "r1"


@pytest.mark.asyncio
async def test_replay_access_audit_fail_open_when_db_unavailable(monkeypatch):
    import app.api.computer_routes as cr
    from app.auth.dependencies import VerifiedRequestContext
    import app.services.browser_worker_pool as pool_mod
    monkeypatch.setattr(pool_mod, "get_worker", lambda rid: None)
    async def fake_replay(run_id, after=0, limit=500, _client=None, user_id=""):
        return {"events": [{"step_index": 1, "type": "a"}], "next_after": 1}
    monkeypatch.setattr(cr, "replay_computer_events", fake_replay)
    async def no_pool():
        return None
    monkeypatch.setattr(cr, "get_pool", no_pool)
    ctx = VerifiedRequestContext(subject="owner-a", tenant_id="00000000-0000-0000-0000-000000000000")
    out = await cr.replay_run_events(run_id="r1", after=0, context=ctx)
    assert out["next_after"] == 1
    assert len(out["events"]) == 1


@pytest.mark.asyncio
async def test_replay_skips_single_malformed_step_index():
    class FakeRedis:
        async def lrange(self, k, a, b):
            return [
                json.dumps({"step_index": 1, "type": "a"}),
                json.dumps({"step_index": "bad", "type": "broken"}),
                json.dumps({"step_index": 3, "type": "c"}),
            ]
    out = await computer_replay.replay_computer_events("r1", after=0, _client=FakeRedis())
    assert [e["step_index"] for e in out["events"]] == [1, 3]
    assert out["next_after"] == 3


@pytest.mark.asyncio
async def test_replay_access_audit_uses_owner_predicate(monkeypatch):
    import uuid
    import app.api.computer_routes as cr
    from app.auth.dependencies import VerifiedRequestContext
    import app.services.browser_worker_pool as pool_mod
    monkeypatch.setattr(pool_mod, "get_worker", lambda rid: None)
    async def fake_replay(run_id, after=0, limit=500, _client=None, user_id=""):
        return {"events": [], "next_after": after}
    monkeypatch.setattr(cr, "replay_computer_events", fake_replay)
    run = str(uuid.uuid4())
    owner = str(uuid.uuid4())
    tenant = str(uuid.uuid4())
    executes = []
    class FakeConn:
        async def execute(self, q, *a):
            executes.append((q, a))
    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()
        async def __aexit__(self, *a):
            return False
    class FakePool:
        def acquire(self):
            return FakeAcquire()
    async def fake_pool():
        return FakePool()
    monkeypatch.setattr(cr, "get_pool", fake_pool)
    ctx = VerifiedRequestContext(subject=owner, tenant_id=tenant)
    await cr.replay_run_events(run_id=run, after=0, context=ctx)
    assert executes, "expected audit insert"
    q, args = executes[0]
    assert "computer_run_events" in q and "user_id" in q
    assert str(args[1]) == owner and str(args[0]) == run and str(args[2]) == tenant


@pytest.mark.asyncio
async def test_replay_access_audits_every_access_with_unique_keys(monkeypatch):
    import uuid as _uuid
    import app.api.computer_routes as cr
    from app.auth.dependencies import VerifiedRequestContext
    import app.services.browser_worker_pool as pool_mod
    monkeypatch.setattr(pool_mod, "get_worker", lambda rid: None)
    async def fake_replay(run_id, after=0, limit=500, _client=None, user_id=""):
        return {"events": [], "next_after": after}
    monkeypatch.setattr(cr, "replay_computer_events", fake_replay)
    run = str(_uuid.uuid4())
    owner = str(_uuid.uuid4())
    tenant = str(_uuid.uuid4())
    keys = []
    class FakeConn:
        async def execute(self, q, *a):
            keys.append(a[3])
    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()
        async def __aexit__(self, *a):
            return False
    class FakePool:
        def acquire(self):
            return FakeAcquire()
    async def fake_pool():
        return FakePool()
    monkeypatch.setattr(cr, "get_pool", fake_pool)
    ctx = VerifiedRequestContext(subject=owner, tenant_id=tenant)
    await cr.replay_run_events(run_id=run, after=0, context=ctx)
    await cr.replay_run_events(run_id=run, after=0, context=ctx)
    assert len(keys) == 2 and keys[0] != keys[1]


def test_worker_start_request_bounds_and_forbids_extra():
    import app.api.computer_routes as cr
    from pydantic import ValidationError
    import pytest as _pt
    with _pt.raises(ValidationError):
        cr.ComputerWorkerStartRequest(url="https://boards.greenhouse.io/a/b", max_timeout=0)
    with _pt.raises(ValidationError):
        cr.ComputerWorkerStartRequest(url="https://boards.greenhouse.io/a/b", max_timeout=601)
    with _pt.raises(ValidationError):
        cr.ComputerWorkerStartRequest(url="https://boards.greenhouse.io/a/b", max_timeout=600, bogus=1)
    assert cr.ComputerWorkerStartRequest(url="https://boards.greenhouse.io/a/b", max_timeout=600).max_timeout == 600


@pytest.mark.asyncio
async def test_terminate_opaque_run_id_flows_without_db_revoke(monkeypatch):
    import app.api.computer_routes as cr
    from app.auth.dependencies import VerifiedRequestContext
    import app.services.browser_worker_pool as pool_mod
    async def fake_term(run_id, owner_id=None):
        return False
    monkeypatch.setattr(pool_mod, "terminate_worker", fake_term)
    import app.services.browser_automation.session as sess
    async def fake_cancel(run_id, owner_id=None):
        return {"ok": True}
    monkeypatch.setattr(sess, "cancel_run", fake_cancel)
    executed = []
    class FakeConn:
        async def execute(self, q, *a):
            executed.append((q, a))
    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()
        async def __aexit__(self, *a):
            return False
    class FakePool:
        def acquire(self):
            return FakeAcquire()
    async def fake_pool():
        return FakePool()
    monkeypatch.setattr(cr, "get_pool", fake_pool)
    ctx = VerifiedRequestContext(subject="owner-a", tenant_id="00000000-0000-0000-0000-000000000000")
    out = await cr.terminate_computer_run(run_id="opaque-worker-id", context=ctx)
    assert out["success"] is True and out["run_id"] == "opaque-worker-id"
    assert executed == []
