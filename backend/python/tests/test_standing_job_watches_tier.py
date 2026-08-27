"""Tier-gating tests for autopilot.run_standing_job_watches.

The Celery beat ticks this task hourly (celery_app.py's "standing-job-watches-hourly"
entry), but each job_watches row must only actually dispatch once its own
schedule_tier interval has elapsed since last_run_at -- not on every hourly tick.
These tests exercise that gate directly against a fake asyncpg pool/connection,
with no real Postgres or Celery broker involved.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

pytest.importorskip("celery")

from app.tasks import automation as automation_task


class FakeConn:
    def __init__(self, rows):
        self._rows = rows
        self.executed = []

    async def fetch(self, query, *args):
        return self._rows

    async def execute(self, query, *args):
        self.executed.append((query, args))


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


def _watch(watch_id: str, tier: str, last_run_at):
    return {
        "watch_id": watch_id,
        "user_id": "11111111-1111-1111-1111-111111111111",
        "query_title": "Backend Engineer",
        "location": "Remote",
        "salary_floor": 100000,
        "schedule_tier": tier,
        "last_run_at": last_run_at,
    }


def _run_task(rows, monkeypatch, match_count=5):
    """Run run_standing_job_watches against fake rows; return (result, conn, fake_delay)."""
    conn = FakeConn(rows)
    pool = FakePool(conn)
    import app.services.db as db_mod
    monkeypatch.setattr(db_mod, "get_pool", AsyncMock(return_value=pool))
    with patch.object(automation_task.run_scheduled, "delay") as fake_delay, \
         patch.object(automation_task, "_count_watch_matches", AsyncMock(return_value=match_count)):
        result = automation_task.run_standing_job_watches.apply().get()
    return result, conn, fake_delay


@pytest.mark.parametrize(
    "tier,hours_since_last_run,should_fire",
    [
        ("hourly", 0.5, False),   # 30 min < 1h interval
        ("hourly", 2, True),      # 2h >= 1h interval
        ("daily", 23, False),     # 23h < 24h interval
        ("daily", 25, True),      # 25h >= 24h interval
        ("weekly", 24 * 3, False),  # 3 days < 7 day interval
        ("weekly", 24 * 8, True),   # 8 days >= 7 day interval
    ],
)
def test_tier_interval_gates_dispatch(tier, hours_since_last_run, should_fire, monkeypatch):
    last_run_at = datetime.now(timezone.utc) - timedelta(hours=hours_since_last_run)
    rows = [_watch("w-1", tier, last_run_at)]

    result, conn, fake_delay = _run_task(rows, monkeypatch)

    assert fake_delay.called is should_fire
    assert result["watches_triggered"] == (1 if should_fire else 0)
    assert result["watches_skipped"] == (0 if should_fire else 1)
    # last_run_at must only be touched when the watch actually dispatched.
    assert len(conn.executed) == (1 if should_fire else 0)


def test_watch_with_no_last_run_always_fires(monkeypatch):
    """A watch that has never run must fire on its first due check regardless of tier."""
    rows = [_watch("w-new", "weekly", None)]

    result, conn, fake_delay = _run_task(rows, monkeypatch)

    assert fake_delay.called is True
    assert result["watches_triggered"] == 1
    assert len(conn.executed) == 1


def test_unknown_tier_falls_back_to_daily_interval(monkeypatch):
    """An unrecognized schedule_tier value must not fire more often than 'daily'."""
    last_run_at = datetime.now(timezone.utc) - timedelta(hours=2)
    rows = [_watch("w-weird", "monthly", last_run_at)]

    result, conn, fake_delay = _run_task(rows, monkeypatch)

    assert fake_delay.called is False
    assert result["watches_triggered"] == 0


def test_beat_restart_does_not_double_fire_same_cycle(monkeypatch):
    """A watch just dispatched must not fire again on an immediate re-run.

    Simulates a beat restart: the task runs once (dispatches + stamps
    last_run_at), then the persisted last_run_at from that first run feeds
    straight into a second run with no time elapsed.
    """
    watch = _watch("w-restart", "hourly", None)
    rows = [watch]

    result1, conn1, fake_delay1 = _run_task(rows, monkeypatch)
    assert fake_delay1.called is True
    assert result1["watches_triggered"] == 1

    # Persist what the first run actually wrote: the UPDATE's second bound
    # param is watch_id, the first is the new last_run_at timestamp.
    stamped_query, stamped_args = conn1.executed[0]
    assert "UPDATE public.job_watches" in stamped_query
    new_last_run_at = stamped_args[0]

    rows_after_restart = [_watch("w-restart", "hourly", new_last_run_at)]
    result2, conn2, fake_delay2 = _run_task(rows_after_restart, monkeypatch)

    assert fake_delay2.called is False
    assert result2["watches_triggered"] == 0
    assert result2["watches_skipped"] == 1
    assert len(conn2.executed) == 0


def test_multiple_watches_mixed_due_states(monkeypatch):
    """Only the due watches dispatch; not-due watches are left untouched."""
    now = datetime.now(timezone.utc)
    rows = [
        _watch("due-hourly", "hourly", now - timedelta(hours=2)),
        _watch("not-due-daily", "daily", now - timedelta(hours=1)),
        _watch("never-run", "weekly", None),
    ]

    result, conn, fake_delay = _run_task(rows, monkeypatch)

    assert result["watches_triggered"] == 2
    assert result["watches_skipped"] == 1
    assert fake_delay.call_count == 2
    dispatched_ids = {args[2] for _, args in conn.executed}
    assert dispatched_ids == {"due-hourly", "never-run"}


def test_match_count_is_persisted_on_dispatch(monkeypatch):
    """A real match count from _count_watch_matches is written alongside last_run_at."""
    rows = [_watch("w-count", "hourly", None)]

    result, conn, fake_delay = _run_task(rows, monkeypatch, match_count=14)

    assert fake_delay.called is True
    assert len(conn.executed) == 1
    _, args = conn.executed[0]
    # UPDATE ... SET last_run_at = $1, last_match_count = $2, ... WHERE watch_id = $3
    assert args[1] == 14
    assert args[2] == "w-count"


def test_match_count_failure_does_not_block_dispatch(monkeypatch):
    """A provider outage must not stop last_run_at from being stamped -- that
    stamp is what prevents a beat restart from double-firing this watch."""
    rows = [_watch("w-outage", "hourly", None)]

    result, conn, fake_delay = _run_task(rows, monkeypatch, match_count=None)

    assert fake_delay.called is True
    assert result["watches_triggered"] == 1
    _, args = conn.executed[0]
    assert args[1] is None


def test_count_watch_matches_returns_none_not_zero_on_provider_failure():
    """None (checked, failed) must stay distinguishable from 0 (checked, no
    matches) -- exercises the real try/except in _count_watch_matches
    directly, not through the task-level mock used above."""
    import asyncio

    async def _boom(*args, **kwargs):
        raise RuntimeError("provider down")

    with patch("app.services.job_providers.search_jobs", _boom):
        result = asyncio.run(automation_task._count_watch_matches("Engineer", "Remote"))

    assert result is None


def test_count_watch_matches_returns_real_length_on_success():
    import asyncio

    async def _fake_search(*args, **kwargs):
        return [{"title": "A"}, {"title": "B"}, {"title": "C"}]

    with patch("app.services.job_providers.search_jobs", _fake_search):
        result = asyncio.run(automation_task._count_watch_matches("Engineer", "Remote"))

    assert result == 3
