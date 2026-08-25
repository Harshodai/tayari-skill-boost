from datetime import datetime, timezone
from uuid import UUID
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import practice_outcomes


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
async def test_record_practice_outcome_requires_explicit_consent(monkeypatch):
    pool = AsyncMock()
    monkeypatch.setattr(practice_outcomes, "get_pool", AsyncMock(return_value=pool))
    payload = {
        "practice_session_id": "session-1",
        "completion_status": "completed",
        "confidence": 80,
        "interview_outcome": "screen",
        "consent_acknowledged": False,
    }
    assert await practice_outcomes.record_practice_outcome("22222222-2222-2222-2222-222222222222", payload) is None
    pool.acquire.assert_not_called()


@pytest.mark.asyncio
async def test_record_practice_outcome_persists_bounded_metadata(monkeypatch):
    row = {
        "id": "11111111-1111-1111-1111-111111111111",
        "application_id": None,
        "practice_session_id": "session-1",
        "completion_status": "completed",
        "confidence": 80,
        "interview_outcome": "screen",
        "correction_note": "Improve answer structure",
        "consent_acknowledged": True,
        "expires_at": None,
        "created_at": datetime(2026, 8, 25, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 8, 25, tzinfo=timezone.utc),
    }
    connection = SimpleNamespace(fetchrow=AsyncMock(return_value=row))
    monkeypatch.setattr(practice_outcomes, "get_pool", AsyncMock(return_value=_Pool(connection)))

    result = await practice_outcomes.record_practice_outcome(
        "22222222-2222-2222-2222-222222222222",
        {
            "practice_session_id": "session-1",
            "completion_status": "completed",
            "confidence": 80,
            "interview_outcome": "screen",
            "correction_note": "Improve answer structure",
            "consent_acknowledged": True,
        },
    )

    assert result["id"] == row["id"]
    query = connection.fetchrow.call_args.args[0]
    assert "LEFT($7, 1000)" in query
    assert "consent_acknowledged" in query
    assert connection.fetchrow.call_args.args[1] == UUID("22222222-2222-2222-2222-222222222222")


@pytest.mark.asyncio
async def test_list_practice_outcomes_is_owner_scoped_and_excludes_expired(monkeypatch):
    connection = SimpleNamespace(fetch=AsyncMock(return_value=[]))
    monkeypatch.setattr(practice_outcomes, "get_pool", AsyncMock(return_value=_Pool(connection)))

    assert await practice_outcomes.list_practice_outcomes("22222222-2222-2222-2222-222222222222", 999) == []
    query = connection.fetch.call_args.args[0]
    assert "user_id = $1::uuid" in query
    assert "expires_at IS NULL OR expires_at > NOW()" in query
    assert connection.fetch.call_args.args[-1] == 200


@pytest.mark.asyncio
async def test_practice_outcomes_fail_closed_when_storage_unavailable(monkeypatch):
    monkeypatch.setattr(practice_outcomes, "get_pool", AsyncMock(return_value=None))
    assert await practice_outcomes.list_practice_outcomes("22222222-2222-2222-2222-222222222222") == []
