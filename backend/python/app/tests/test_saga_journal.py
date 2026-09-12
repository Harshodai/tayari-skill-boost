"""Tests for saga.py's durable journal and orphan-recovery sweep.

Covers what changed in the 2026-09-12 durability pass: every step
transition is upserted to a (faked) Postgres table, a journal write failure
never breaks the saga itself, and a saga whose journal row was left
"running" past the staleness window (simulating a worker crash mid-saga —
nothing ever wrote a terminal status) gets correctly detected and marked
"orphaned" by recover_orphaned_sagas(), without touching fresh or already-
terminal rows.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from app.services.saga import SagaContext, SagaStatus, StepStatus, recover_orphaned_sagas


class FakeAcquireCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


class FakePool:
    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        return FakeAcquireCtx(self._conn)


class FakeSagaDB:
    """Simulates just enough of Postgres to exercise saga.py's real SQL.

    Journal rows are keyed by (task_id, saga_name), matching the real
    table's UNIQUE constraint and the ON CONFLICT clause in _journal_upsert.
    """

    def __init__(self):
        self.rows: dict[tuple[str, str], dict] = {}
        self.write_count = 0

    async def execute(self, query: str, *args) -> None:
        if "INSERT INTO saga_journal" in query:
            self.write_count += 1
            task_id, user_id, saga_name, status, steps_json, error = args
            key = (task_id, saga_name)
            existing = self.rows.get(key, {})
            self.rows[key] = {
                "task_id": task_id,
                "user_id": user_id,
                "saga_name": saga_name,
                "status": status,
                "steps": json.loads(steps_json),
                "error": error,
                "updated_at": datetime.now(timezone.utc),
                "completed_at": datetime.now(timezone.utc) if status in ("completed", "failed") else existing.get("completed_at"),
            }
            return
        raise AssertionError(f"FakeSagaDB.execute got unexpected query: {query!r}")

    async def fetch(self, query: str, *args):
        if "UPDATE saga_journal" in query and "RETURNING" in query:
            (cutoff,) = args
            reclaimed = []
            for key, row in self.rows.items():
                if row["status"] == "running" and row["updated_at"] < cutoff:
                    row["status"] = "orphaned"
                    row["error"] = (
                        "worker crashed or restarted mid-saga; the browser session "
                        "is unrecoverable, retry the whole flow"
                    )
                    row["updated_at"] = datetime.now(timezone.utc)
                    row["completed_at"] = datetime.now(timezone.utc)
                    reclaimed.append({"task_id": row["task_id"], "saga_name": row["saga_name"]})
            return reclaimed
        raise AssertionError(f"FakeSagaDB.fetch got unexpected query: {query!r}")


@pytest.fixture
def fake_db(monkeypatch):
    db = FakeSagaDB()
    pool = FakePool(db)

    import app.services.saga as saga_module
    monkeypatch.setattr(saga_module, "_get_pool_safe", AsyncMock(return_value=pool))
    return db


@pytest.mark.asyncio
async def test_run_persists_completed_journal_on_success(fake_db):
    saga = SagaContext(task_id="t-1", user_id="u-1", saga_name="test_flow")
    saga.add_step("step_one", execute=lambda: _ok())
    saga.add_step("step_two", execute=lambda: _ok())

    result = await saga.run()

    assert result["success"] is True
    row = fake_db.rows[("t-1", "test_flow")]
    assert row["status"] == "completed"
    assert row["error"] is None
    assert [s["status"] for s in row["steps"]] == ["completed", "completed"]
    assert row["completed_at"] is not None
    # Journal writes happen incrementally, not just once at the end: initial
    # running snapshot + per-step running + per-step completed + final.
    assert fake_db.write_count > 2


@pytest.mark.asyncio
async def test_run_persists_failed_journal_with_compensation(fake_db):
    saga = SagaContext(task_id="t-2", user_id="u-1", saga_name="test_flow")
    saga.add_step("step_one", execute=lambda: _ok(), compensate=lambda: _ok())
    saga.add_step("step_two", execute=lambda: _boom())

    result = await saga.run()

    assert result["success"] is False
    row = fake_db.rows[("t-2", "test_flow")]
    assert row["status"] == "failed"
    assert "kaboom" in row["error"]
    steps_by_name = {s["name"]: s for s in row["steps"]}
    assert steps_by_name["step_one"]["status"] == "compensated"
    assert steps_by_name["step_two"]["status"] == "failed"


@pytest.mark.asyncio
async def test_journal_write_failure_never_breaks_the_saga(monkeypatch):
    """A totally unavailable DB pool must degrade to a no-op, not raise."""
    import app.services.saga as saga_module
    monkeypatch.setattr(saga_module, "_get_pool_safe", AsyncMock(return_value=None))

    saga = SagaContext(task_id="t-3", user_id="u-1")
    saga.add_step("step_one", execute=lambda: _ok())

    result = await saga.run()

    assert result["success"] is True
    assert result["steps_completed"] == ["step_one"]


@pytest.mark.asyncio
async def test_journal_write_exception_never_breaks_the_saga(monkeypatch):
    """A pool that raises mid-write (not just unavailable) must also degrade
    to a no-op — _journal_upsert's own try/except must catch it."""
    import app.services.saga as saga_module

    class ExplodingPool:
        def acquire(self):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(saga_module, "_get_pool_safe", AsyncMock(return_value=ExplodingPool()))

    saga = SagaContext(task_id="t-4", user_id="u-1")
    saga.add_step("step_one", execute=lambda: _ok())

    result = await saga.run()

    assert result["success"] is True


@pytest.mark.asyncio
async def test_recover_orphaned_sagas_marks_stale_running_row(fake_db):
    """Simulates a worker crash: a saga journal row was stamped 'running' by
    an earlier step transition and then nothing ever wrote a terminal
    status (the process died before the next write). The sweep must find
    it and mark it orphaned, without attempting to resume or compensate."""
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    fake_db.rows[("crashed-task", "application_flow")] = {
        "task_id": "crashed-task",
        "user_id": "u-1",
        "saga_name": "application_flow",
        "status": "running",
        "steps": [
            {"name": "navigate_to_job", "status": "completed", "resumable": False, "error": None, "result": {"url": "x"}},
            {"name": "fill_application_form", "status": "running", "resumable": False, "error": None, "result": None},
        ],
        "error": None,
        "updated_at": stale_time,
        "completed_at": None,
    }

    count = await recover_orphaned_sagas(staleness=timedelta(minutes=10))

    assert count == 1
    row = fake_db.rows[("crashed-task", "application_flow")]
    assert row["status"] == "orphaned"
    assert "unrecoverable" in row["error"]
    assert row["completed_at"] is not None


@pytest.mark.asyncio
async def test_recover_orphaned_sagas_ignores_fresh_running_row(fake_db):
    """A watch that's genuinely still executing (updated recently) must not
    be misdiagnosed as orphaned just because it's slow."""
    fake_db.rows[("live-task", "application_flow")] = {
        "task_id": "live-task",
        "user_id": "u-1",
        "saga_name": "application_flow",
        "status": "running",
        "steps": [],
        "error": None,
        "updated_at": datetime.now(timezone.utc) - timedelta(seconds=30),
        "completed_at": None,
    }

    count = await recover_orphaned_sagas(staleness=timedelta(minutes=10))

    assert count == 0
    assert fake_db.rows[("live-task", "application_flow")]["status"] == "running"


@pytest.mark.asyncio
async def test_recover_orphaned_sagas_ignores_terminal_rows(fake_db):
    """A completed/failed row must never be touched, no matter how old."""
    ancient = datetime.now(timezone.utc) - timedelta(days=30)
    fake_db.rows[("old-done-task", "application_flow")] = {
        "task_id": "old-done-task",
        "user_id": "u-1",
        "saga_name": "application_flow",
        "status": "completed",
        "steps": [],
        "error": None,
        "updated_at": ancient,
        "completed_at": ancient,
    }

    count = await recover_orphaned_sagas(staleness=timedelta(minutes=10))

    assert count == 0
    assert fake_db.rows[("old-done-task", "application_flow")]["status"] == "completed"


@pytest.mark.asyncio
async def test_recover_orphaned_sagas_degrades_safely_with_no_db(monkeypatch):
    import app.services.saga as saga_module
    monkeypatch.setattr(saga_module, "_get_pool_safe", AsyncMock(return_value=None))

    count = await recover_orphaned_sagas()

    assert count == 0


async def _ok():
    return {"ok": True}


async def _boom():
    raise RuntimeError("kaboom")
