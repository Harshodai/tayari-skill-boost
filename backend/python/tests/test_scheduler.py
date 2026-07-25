"""Scheduler tests.

Validates the WS-D scheduler changes:
- When Postgres is unavailable (pool None), one scheduler tick exits cleanly.
- When a due schedule row is present, the scheduler enqueues a Celery
  ``run_scheduled_autopilot`` task with the correct args and bumps
  ``next_run_at``/``last_run_at`` in the DB.

No real Celery broker or Postgres is needed: the asyncpg pool is monkeypatched
to a fake and ``run_scheduled_autopilot.apply_async`` is stubbed.

Run: python -m pytest tests/test_scheduler.py -v
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import pytest

pytest.importorskip("pydantic")

from app.services import scheduler


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

class _FakeConn:
    """Records executes/queries against the fake pool's in-memory state."""

    def __init__(self, state: dict) -> None:
        self._state = state

    async def fetch(self, sql: str, *args: Any) -> list[dict]:
        return list(self._state.get("due_rows", []))

    async def fetchrow(self, sql: str, *args: Any) -> dict | None:
        # Profile/resume loaders: return nothing by default.
        return None

    async def execute(self, sql: str, *args: Any) -> str:
        self._state.setdefault("executes", []).append({"sql": sql, "args": args})
        return "UPDATE 1"

    async def __aenter__(self) -> "_FakeConn":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        return None


class _FakePool:
    """Asyncpg-pool-like object yielding ``_FakeConn`` from acquire()."""

    def __init__(self, state: dict) -> None:
        self._state = state

    def acquire(self) -> _FakeConn:
        return _FakeConn(self._state)


@pytest.fixture
def clean_env(monkeypatch):
    """Reset scheduler module-level state between tests."""
    # Clear the in-memory store so the DB-backed path is the only source.
    scheduler._schedules.clear()


def _patch_pool(monkeypatch: pytest.MonkeyPatch, state: dict) -> None:
    """Monkeypatch app.services.db.get_pool to return a fake pool bound to ``state``."""
    fake_pool = _FakePool(state)

    async def _fake_get_pool() -> Any:
        return fake_pool

    # get_pool is imported lazily inside the scheduler functions, so patching
    # the source module is enough.
    from app.services import db
    monkeypatch.setattr(db, "get_pool", _fake_get_pool)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_tick_exits_cleanly_when_no_db(clean_env, monkeypatch):
    """When get_pool() returns None, one tick logs and returns without raising."""
    async def _none_pool() -> None:
        return None

    from app.services import db
    monkeypatch.setattr(db, "get_pool", _none_pool)

    async def run() -> None:
        await scheduler._tick()

    # Should not raise.
    asyncio.run(run())


def test_tick_enqueues_celery_task_and_bumps_next_run(clean_env, monkeypatch):
    """A due schedule row -> one Celery enqueue + one UPDATE on autopilot_schedules."""
    due_at = datetime.now(timezone.utc).isoformat()
    state = {
        "due_rows": [
            {
                "schedule_id": "sch-123",
                "user_id": "user-abc",
                "frequency": "daily",
                "config": {"target_roles": ["engineer"]},
                "next_run_at": due_at,
                "last_run_at": None,
            }
        ],
    }
    _patch_pool(monkeypatch, state)

    # Stub the Celery task's apply_async via a module-level replacement.
    enqueued: list[dict] = []

    class _FakeTask:
        def apply_async(self, args: tuple, queue: str | None = None) -> Any:
            enqueued.append({"args": args, "queue": queue})
            return type("R", (), {"id": "task-xyz"})()

    # Inject a fake ``app.tasks.automation`` module so the lazy import resolves
    # to our stub without requiring a real Celery broker.
    import sys
    import types
    fake_mod = types.ModuleType("app.tasks.automation")
    fake_mod.run_scheduled_autopilot = _FakeTask()  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "app.tasks.automation", fake_mod)

    async def run() -> None:
        await scheduler._tick()

    asyncio.run(run())

    # Exactly one enqueue with the expected args + queue.
    assert len(enqueued) == 1
    args = enqueued[0]["args"]
    assert args[0] == "sch-123"
    assert args[1] == "user-abc"
    config = args[2]
    assert config["user_id"] == "user-abc"
    assert config["schedule_id"] == "sch-123"
    assert config["target_roles"] == ["engineer"]
    assert enqueued[0]["queue"] == "tayari"

    # The schedule row was bumped: one UPDATE against autopilot_schedules.
    updates = [e for e in state.get("executes", [])
               if "autopilot_schedules" in e["sql"]]
    assert len(updates) == 1
    assert updates[0]["args"][0] == "sch-123"
    # next_run_at is the second arg and must be a future ISO timestamp.
    assert updates[0]["args"][1] > due_at


def test_tick_with_no_due_rows_enqueues_nothing(clean_env, monkeypatch):
    """No due rows -> no enqueue, no UPDATE."""
    state: dict = {"due_rows": []}
    _patch_pool(monkeypatch, state)

    enqueued: list = []

    class _FakeTask:
        def apply_async(self, args: tuple, queue: str | None = None) -> Any:
            enqueued.append(args)
            return type("R", (), {"id": "t"})()

    import sys
    import types
    fake_mod = types.ModuleType("app.tasks.automation")
    fake_mod.run_scheduled_autopilot = _FakeTask()  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "app.tasks.automation", fake_mod)

    async def run() -> None:
        await scheduler._tick()

    asyncio.run(run())
    assert enqueued == []
    assert state.get("executes", []) == []


def test_load_profile_returns_none_without_db(clean_env, monkeypatch):
    async def _none() -> None:
        return None

    from app.services import db
    monkeypatch.setattr(db, "get_pool", _none)

    result = asyncio.run(scheduler._load_profile_for_user("user-1"))
    assert result is None


def test_load_resume_returns_empty_without_db(clean_env, monkeypatch):
    async def _none() -> None:
        return None

    from app.services import db
    monkeypatch.setattr(db, "get_pool", _none)

    result = asyncio.run(scheduler._load_resume_for_user("user-1"))
    assert result == ""


def test_maybe_await_handles_sync_and_coroutine(clean_env):
    """_maybe_await calls sync callables directly and awaits coroutines."""
    sync_result = asyncio.run(scheduler._maybe_await(lambda x: x * 2, 3))
    assert sync_result == 6

    async def _coro(x: int) -> int:
        return x + 1

    coro_result = asyncio.run(scheduler._maybe_await(_coro, 10))
    assert coro_result == 11