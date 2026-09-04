"""Tests for Outcome Learning Loop Analytics (WP-09)."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest

from app.services.outcome_analytics import (
    compute_outcome_metrics,
    record_outcome_event,
    list_outcome_events,
    wilson_score_interval,
)
from app.services import outcome_analytics


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


def test_wilson_score_interval_zero_sample():
    res = wilson_score_interval(0, 0)
    assert res["n"] == 0
    assert res["point_estimate"] == 0.0
    assert res["display"] == "0% (n=0, ±0%)"


def test_wilson_score_interval_small_sample_includes_confidence_interval():
    res = wilson_score_interval(8, 12)
    assert res["n"] == 12
    assert res["successes"] == 8
    assert 0.0 < res["lower"] < res["point_estimate"] < res["upper"] <= 1.0
    assert res["margin_percentage"] > 0
    # Must format as e.g. "67% (n=12, ±24%)" - never bare percentage
    assert "n=12" in res["display"]
    assert "±" in res["display"]
    assert "%" in res["display"]


def test_wilson_score_interval_boundaries():
    # 0 successes out of 10
    zero_res = wilson_score_interval(0, 10)
    assert zero_res["lower"] == 0.0
    assert zero_res["upper"] > 0.0
    assert "n=10" in zero_res["display"]

    # 10 successes out of 10
    full_res = wilson_score_interval(10, 10)
    assert full_res["lower"] < 1.0
    assert full_res["upper"] == 1.0
    assert "n=10" in full_res["display"]


def test_compute_outcome_metrics_empty():
    res = compute_outcome_metrics([])
    assert res["sample_size"] == 0
    assert res["match_precision"]["n"] == 0
    assert res["match_precision"]["display"] == "0% (n=0, ±0%)"
    assert res["artifact_acceptance_rate"]["n"] == 0
    assert res["repeat_workflow_rate"]["n"] == 0


def test_compute_outcome_metrics_with_events():
    events = [
        {
            "id": "1",
            "application_run_id": "run-1",
            "event_type": "applied",
            "is_candidate_confirmed": True,
            "is_externally_verified": True,
        },
        {
            "id": "2",
            "application_run_id": "run-1",
            "event_type": "interviewing",
            "is_candidate_confirmed": True,
            "is_externally_verified": False,
        },
        {
            "id": "3",
            "application_run_id": "run-2",
            "event_type": "rejected",
            "is_candidate_confirmed": True,
            "is_externally_verified": False,
        },
        {
            "id": "4",
            "application_run_id": "run-3",
            "event_type": "offer",
            "is_candidate_confirmed": True,
            "is_externally_verified": True,
        },
    ]
    res = compute_outcome_metrics(events)
    assert res["sample_size"] == 4
    assert res["candidate_confirmed_count"] == 4
    assert res["externally_verified_count"] == 2
    # Check that each metric has Wilson interval with n and margin
    for key in ["match_precision", "artifact_acceptance_rate", "repeat_workflow_rate"]:
        assert "display" in res[key]
        assert "±" in res[key]["display"]
        assert "n=" in res[key]["display"]


@pytest.mark.asyncio
async def test_record_outcome_event_rejects_invalid_event_type(monkeypatch):
    pool = AsyncMock()
    monkeypatch.setattr(outcome_analytics, "get_pool", AsyncMock(return_value=pool))
    payload = {
        "event_type": "invalid_stage",
        "is_candidate_confirmed": True,
    }
    res = await record_outcome_event("11111111-1111-1111-1111-111111111111", payload)
    assert res is None
    pool.acquire.assert_not_called()


@pytest.mark.asyncio
async def test_record_outcome_event_prevents_client_setting_externally_verified(monkeypatch):
    mock_row = {
        "id": "22222222-2222-2222-2222-222222222222",
        "user_id": "11111111-1111-1111-1111-111111111111",
        "application_run_id": None,
        "event_type": "applied",
        "is_candidate_confirmed": True,
        "is_externally_verified": False,  # Client cannot force this to True
        "notes": "Applied via site",
        "created_at": datetime(2026, 9, 3, tzinfo=timezone.utc),
    }
    connection = SimpleNamespace(fetchrow=AsyncMock(return_value=mock_row))
    monkeypatch.setattr(outcome_analytics, "get_pool", AsyncMock(return_value=_Pool(connection)))

    # Client tries to send is_externally_verified=True without service role
    payload = {
        "event_type": "applied",
        "is_candidate_confirmed": True,
        "is_externally_verified": True,
        "notes": "Applied via site",
    }
    res = await record_outcome_event(
        "11111111-1111-1111-1111-111111111111",
        payload,
        is_service_role=False,
    )
    assert res is not None
    # Verify SQL query received False for is_externally_verified
    called_args = connection.fetchrow.call_args[0]
    # Arg 5 is is_externally_verified
    assert called_args[5] is False


@pytest.mark.asyncio
async def test_record_outcome_event_allows_service_role_externally_verified(monkeypatch):
    mock_row = {
        "id": "33333333-3333-3333-3333-333333333333",
        "user_id": "11111111-1111-1111-1111-111111111111",
        "application_run_id": None,
        "event_type": "offer",
        "is_candidate_confirmed": True,
        "is_externally_verified": True,
        "notes": "Cryptographically verified submission",
        "created_at": datetime(2026, 9, 3, tzinfo=timezone.utc),
    }
    connection = SimpleNamespace(fetchrow=AsyncMock(return_value=mock_row))
    monkeypatch.setattr(outcome_analytics, "get_pool", AsyncMock(return_value=_Pool(connection)))

    payload = {
        "event_type": "offer",
        "is_candidate_confirmed": True,
        "is_externally_verified": True,
        "notes": "Cryptographically verified submission",
    }
    res = await record_outcome_event(
        "11111111-1111-1111-1111-111111111111",
        payload,
        is_service_role=True,
    )
    assert res is not None
    called_args = connection.fetchrow.call_args[0]
    assert called_args[5] is True
