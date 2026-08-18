from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from app.services.automation_catalog import AutomationActionRejected, require_known_action
from app.services.automation_events import (
    AutomationEvent,
    AutomationEventRejected,
    definition_matches_event,
    enqueue_event,
)


def _ids():
    return uuid.uuid4(), uuid.uuid4(), uuid.uuid4()


def test_event_requires_verified_identity_binding():
    event_id, tenant_id, user_id = _ids()
    with pytest.raises(AutomationEventRejected, match="tenant"):
        AutomationEvent.create(
            event_id=event_id,
            event_type="job_match.found",
            tenant_id=tenant_id,
            user_id=user_id,
            source="test",
            verified_tenant_id=uuid.uuid4(),
            verified_user_id=user_id,
        )


def test_event_rejects_oversized_payload():
    event_id, tenant_id, user_id = _ids()
    with pytest.raises(AutomationEventRejected, match="64 KiB"):
        AutomationEvent.create(
            event_id=event_id,
            event_type="job_match.found",
            tenant_id=tenant_id,
            user_id=user_id,
            source="test",
            payload={"blob": "x" * (64 * 1024)},
        )


def test_unknown_action_is_rejected_before_routing():
    with pytest.raises(AutomationActionRejected, match="not registered"):
        require_known_action("arbitrary.database.tool")


def test_action_capability_is_fail_closed_in_staging(monkeypatch):
    from app.services.automation_events import _config_action_ids

    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.delenv("CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH", raising=False)
    with pytest.raises(AutomationActionRejected, match="capability is disabled"):
        _config_action_ids(["jobs.refresh_watch"])


def test_definition_matching_requires_explicit_event_or_supported_trigger():
    definition = {"trigger_type": "provider_event", "trigger_config": {}, "updated_at": datetime.now(timezone.utc)}
    assert definition_matches_event(definition, "job_match.found")
    assert not definition_matches_event(definition, "learning.sweep_due")
    explicit = {"trigger_type": "manual", "trigger_config": {"event_types": ["candidate_bundle.requested"]}}
    assert definition_matches_event(explicit, "candidate_bundle.requested")
    assert not definition_matches_event(explicit, "job_match.found")


class _Conn:
    def __init__(self, inserted):
        self.inserted = inserted
        self.calls = []

    async def fetchval(self, query, *args):
        self.calls.append((query, args))
        return self.inserted


@pytest.mark.asyncio
async def test_enqueue_event_returns_duplicate_truthfully():
    event_id, tenant_id, user_id = _ids()
    event = AutomationEvent.create(
        event_id=event_id,
        event_type="job_watch.due",
        tenant_id=tenant_id,
        user_id=user_id,
        source="test",
        payload={"watch_id": str(uuid.uuid4())},
    )
    first = await enqueue_event(_Conn(event_id), event)
    duplicate = await enqueue_event(_Conn(None), event)
    assert first is True
    assert duplicate is False


class _ScheduleConn:
    def __init__(self):
        self.inserted = []

    async def fetch(self, query, *args):
        return [{"tenant_id": uuid.uuid4(), "user_id": uuid.uuid4()}]

    async def fetchval(self, query, *args):
        self.inserted.append(args)
        return args[0]


@pytest.mark.asyncio
async def test_scheduled_events_are_tenant_scoped_and_deterministic():
    from app.services.automation_events import emit_scheduled_events

    conn = _ScheduleConn()
    moment = datetime(2026, 8, 20, 12, 34, tzinfo=timezone.utc)
    result = await emit_scheduled_events(conn, now=moment)

    assert result["tenants"] == 1
    assert result["emitted"] == 3
    assert len(conn.inserted) == 3
    assert all(isinstance(args[0], uuid.UUID) for args in conn.inserted)
    assert all(args[1] != args[2] for args in conn.inserted)
