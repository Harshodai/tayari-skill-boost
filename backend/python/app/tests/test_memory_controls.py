from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import memory_controls


class _Acquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *_):
        return None


class _Pool:
    def __init__(self, connection):
        self.connection = connection

    def acquire(self):
        return _Acquire(self.connection)


@pytest.mark.asyncio
async def test_list_memory_controls_is_bounded_and_owner_scoped(monkeypatch):
    row = {
        "id": "11111111-1111-1111-1111-111111111111",
        "job_id": "job-1",
        "job_title": "Data Engineer",
        "company_name": "Example",
        "feedback_type": "liked",
        "feedback_source": "manual",
        "confidence": "user_confirmed",
        "is_active": True,
        "expires_at": None,
        "corrected_at": None,
        "created_at": datetime(2026, 8, 25, tzinfo=timezone.utc),
    }
    connection = SimpleNamespace(fetch=AsyncMock(return_value=[row]))
    monkeypatch.setattr(memory_controls, "get_pool", AsyncMock(return_value=_Pool(connection)))

    controls = await memory_controls.list_memory_controls("22222222-2222-2222-2222-222222222222", limit=999)

    assert controls[0]["id"] == row["id"]
    assert connection.fetch.call_args.args[-1] == 200
    assert "user_id = $1::uuid" in connection.fetch.call_args.args[0]


@pytest.mark.asyncio
async def test_update_memory_control_preserves_expiry_and_owner_predicate(monkeypatch):
    row = {
        "id": "11111111-1111-1111-1111-111111111111",
        "job_id": "job-1",
        "job_title": None,
        "company_name": None,
        "feedback_type": "skipped",
        "feedback_source": "auto_detected",
        "confidence": "user_confirmed",
        "is_active": False,
        "expires_at": datetime(2026, 9, 1, tzinfo=timezone.utc),
        "corrected_at": datetime(2026, 8, 25, tzinfo=timezone.utc),
        "created_at": datetime(2026, 8, 20, tzinfo=timezone.utc),
    }
    connection = SimpleNamespace(fetchrow=AsyncMock(return_value=row))
    monkeypatch.setattr(memory_controls, "get_pool", AsyncMock(return_value=_Pool(connection)))

    updated = await memory_controls.update_memory_control(
        "22222222-2222-2222-2222-222222222222",
        row["id"],
        is_active=False,
        confidence="user_confirmed",
        expires_at=row["expires_at"],
    )

    assert updated["is_active"] is False
    assert updated["expires_at"].startswith("2026-09-01")
    assert "id = $1::uuid AND user_id = $2::uuid" in connection.fetchrow.call_args.args[0]


@pytest.mark.asyncio
async def test_delete_memory_control_returns_false_when_owner_row_is_missing(monkeypatch):
    connection = SimpleNamespace(execute=AsyncMock(return_value="DELETE 0"))
    monkeypatch.setattr(memory_controls, "get_pool", AsyncMock(return_value=_Pool(connection)))

    deleted = await memory_controls.delete_memory_control(
        "22222222-2222-2222-2222-222222222222",
        "11111111-1111-1111-1111-111111111111",
    )

    assert deleted is False
    assert "id = $1::uuid AND user_id = $2::uuid" in connection.execute.call_args.args[0]


@pytest.mark.asyncio
async def test_memory_controls_fail_closed_when_pool_is_unavailable(monkeypatch):
    monkeypatch.setattr(memory_controls, "get_pool", AsyncMock(return_value=None))

    assert await memory_controls.list_memory_controls("22222222-2222-2222-2222-222222222222") == []
    assert await memory_controls.update_memory_control("22222222-2222-2222-2222-222222222222", "bad-id") is None
    assert await memory_controls.delete_memory_control("22222222-2222-2222-2222-222222222222", "bad-id") is False
