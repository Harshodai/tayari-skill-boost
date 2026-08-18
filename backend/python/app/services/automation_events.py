"""Durable, tenant-scoped event routing for the automation runtime."""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.services.automation_catalog import AutomationActionRejected, action_capabilities_enabled, require_known_action

logger = logging.getLogger(__name__)

MAX_PAYLOAD_BYTES = 64 * 1024

_EVENT_TRIGGER_DEFAULTS: dict[str, set[str]] = {
    "job_watch.due": {"schedule", "task_event"},
    "job_watch.requested": {"manual", "task_event"},
    "job_match.found": {"provider_event", "task_event"},
    "candidate_bundle.requested": {"manual", "task_event"},
    "application.stage_changed": {"task_event", "provider_event"},
    "application.outcome_recorded": {"task_event", "provider_event"},
    "pipeline.sweep_due": {"schedule"},
    "automation.approval.requested": {"approval_decision", "task_event"},
    "automation.approval.approved": {"approval_decision", "task_event"},
    "automation.approval.denied": {"approval_decision", "task_event"},
    "notification.retry_due": {"schedule", "task_event"},
    "calendar.interview_detected": {"provider_event", "task_event"},
    "learning.sweep_due": {"schedule"},
}


class AutomationEventRejected(ValueError):
    """Raised when an event fails the tenant, size, or identity contract."""


@dataclass(frozen=True)
class AutomationEvent:
    event_id: uuid.UUID
    event_type: str
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    occurred_at: datetime
    source: str
    payload: dict[str, Any]

    @classmethod
    def create(
        cls,
        *,
        event_id: str | uuid.UUID,
        event_type: str,
        tenant_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
        source: str,
        payload: dict[str, Any] | None = None,
        occurred_at: datetime | None = None,
        verified_tenant_id: str | uuid.UUID | None = None,
        verified_user_id: str | uuid.UUID | None = None,
    ) -> "AutomationEvent":
        try:
            event_uuid = uuid.UUID(str(event_id))
            tenant_uuid = uuid.UUID(str(tenant_id))
            user_uuid = uuid.UUID(str(user_id))
        except (TypeError, ValueError) as exc:
            raise AutomationEventRejected("event, tenant, and user identifiers must be UUIDs") from exc
        if verified_tenant_id is not None and tenant_uuid != uuid.UUID(str(verified_tenant_id)):
            raise AutomationEventRejected("event tenant does not match verified tenant context")
        if verified_user_id is not None and user_uuid != uuid.UUID(str(verified_user_id)):
            raise AutomationEventRejected("event user does not match verified user context")
        normalized_type = str(event_type or "").strip()
        normalized_source = str(source or "").strip()
        if not normalized_type or len(normalized_type) > 160:
            raise AutomationEventRejected("event_type is required and bounded")
        if not normalized_source or len(normalized_source) > 160:
            raise AutomationEventRejected("source is required and bounded")
        safe_payload = payload if isinstance(payload, dict) else {}
        encoded = json.dumps(safe_payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        if len(encoded) > MAX_PAYLOAD_BYTES:
            raise AutomationEventRejected("event payload exceeds the 64 KiB limit")
        timestamp = occurred_at or datetime.now(timezone.utc)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        return cls(event_uuid, normalized_type, tenant_uuid, user_uuid, timestamp, normalized_source, safe_payload)


def _config_action_ids(tool_allowlist: Any) -> list[str]:
    if not isinstance(tool_allowlist, list):
        return []
    action_ids: list[str] = []
    for value in tool_allowlist:
        action_id = value.get("action_id") if isinstance(value, dict) else value
        action = require_known_action(str(action_id or ""))
        if not action_capabilities_enabled(action):
            raise AutomationActionRejected(f"required capability is disabled for {action.action_id}")
        action_ids.append(action.action_id)
    return action_ids


def _config_event_types(trigger_config: Any) -> set[str]:
    if not isinstance(trigger_config, dict):
        return set()
    raw = trigger_config.get("event_types")
    if isinstance(raw, str):
        return {raw.strip()} if raw.strip() else set()
    if isinstance(raw, list):
        return {str(value).strip() for value in raw if str(value).strip()}
    return set()


def definition_matches_event(definition: Any, event_type: str) -> bool:
    """Match an active definition without treating an empty policy as allow-all."""
    trigger_type = str(definition["trigger_type"] or "").strip()
    configured = _config_event_types(definition.get("trigger_config"))
    if configured and event_type not in configured:
        return False
    if configured:
        return True
    return trigger_type in _EVENT_TRIGGER_DEFAULTS.get(event_type, set())


async def enqueue_event(conn: Any, event: AutomationEvent) -> bool:
    """Persist an event exactly once; duplicate provider events are harmless."""
    inserted = await conn.fetchval(
        """
        INSERT INTO automation_event_inbox
            (event_id, tenant_id, user_id, event_type, source, occurred_at, payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
        """,
        event.event_id,
        event.tenant_id,
        event.user_id,
        event.event_type,
        event.source,
        event.occurred_at,
        json.dumps(event.payload, separators=(",", ":"), default=str),
    )
    return inserted is not None


async def _record_run_event(conn: Any, run_id: Any, event: AutomationEvent, event_type: str, payload: dict[str, Any]) -> None:
    await conn.execute(
        """
        INSERT INTO automation_events (run_id, tenant_id, user_id, event_type, payload)
        VALUES ($1,$2,$3,$4,$5::jsonb)
        """,
        run_id,
        event.tenant_id,
        event.user_id,
        event_type,
        json.dumps(payload, separators=(",", ":"), default=str),
    )


async def _dispatch_one(conn: Any, row: Any) -> int:
    event = AutomationEvent.create(
        event_id=row["event_id"],
        event_type=row["event_type"],
        tenant_id=row["tenant_id"],
        user_id=row["user_id"],
        occurred_at=row["occurred_at"],
        source=row["source"],
        payload=row["payload"] if isinstance(row["payload"], dict) else {},
    )
    definitions = await conn.fetch(
        """
        SELECT id, trigger_type, trigger_config, tool_allowlist, approval_policy, policy_version, updated_at
        FROM automation_definitions
        WHERE tenant_id=$1 AND user_id=$2 AND status='active'
        ORDER BY updated_at DESC
        """,
        event.tenant_id,
        event.user_id,
    )
    matched = 0
    for definition in definitions:
        if not definition_matches_event(definition, event.event_type):
            continue
        try:
            action_ids = _config_action_ids(definition["tool_allowlist"])
        except AutomationActionRejected as exc:
            logger.warning("automation definition %s rejected for event %s: %s", definition["id"], event.event_id, exc)
            continue
        policy_version = str(definition["policy_version"] or "v1")
        action_fingerprint = ",".join(action_ids) or "plan_review"
        idempotency_key = f"event:{event.event_id}:definition:{definition['id']}:policy:{policy_version}:actions:{action_fingerprint}"
        run_id = await conn.fetchval(
            """
            INSERT INTO automation_runs
                (definition_id, tenant_id, user_id, status, idempotency_key, expires_at, trigger_event_id, definition_version)
            VALUES ($1,$2,$3,'queued',$4,now()+interval '24 hours',$5,1)
            ON CONFLICT (tenant_id,user_id,idempotency_key) DO UPDATE SET updated_at=now()
            RETURNING id
            """,
            definition["id"],
            event.tenant_id,
            event.user_id,
            idempotency_key,
            event.event_id,
        )
        if run_id is not None:
            await _record_run_event(
                conn,
                run_id,
                event,
                "automation.event.dispatched",
                {"event_id": str(event.event_id), "event_type": event.event_type, "source": event.source, "action_ids": action_ids},
            )
            matched += 1
    await conn.execute(
        """
        UPDATE automation_event_inbox
        SET status='dispatched', updated_at=now(), last_error=NULL
        WHERE event_id=$1 AND tenant_id=$2 AND user_id=$3
        """,
        event.event_id,
        event.tenant_id,
        event.user_id,
    )
    return matched


async def emit_scheduled_events(conn: Any, now: datetime | None = None) -> dict[str, int]:
    """Emit deterministic recurring events for every active tenant automation."""
    current = now or datetime.now(timezone.utc)
    definitions = await conn.fetch(
        """
        SELECT DISTINCT tenant_id, user_id
        FROM automation_definitions
        WHERE status='active'
        """
    )
    event_specs = (
        ("pipeline.sweep_due", current.strftime("%Y-%m-%dT%H")),
        ("notification.retry_due", current.strftime("%Y-%m-%dT%H:%M")),
        ("learning.sweep_due", current.strftime("%Y-%m-%d")),
    )
    emitted = 0
    duplicates = 0
    for tenant in definitions:
        for event_type, bucket in event_specs:
            event_id = uuid.uuid5(uuid.NAMESPACE_URL, f"tayari:{event_type}:{tenant['tenant_id']}:{tenant['user_id']}:{bucket}")
            event = AutomationEvent.create(
                event_id=event_id,
                event_type=event_type,
                tenant_id=tenant["tenant_id"],
                user_id=tenant["user_id"],
                source="celery.automation_schedule",
                payload={"bucket": bucket},
                occurred_at=current,
            )
            if await enqueue_event(conn, event):
                emitted += 1
            else:
                duplicates += 1
    return {"tenants": len(definitions), "emitted": emitted, "duplicates": duplicates}


async def dispatch_due_events(conn: Any, limit: int = 100) -> dict[str, int]:
    """Claim and route due events with bounded retries and owner predicates."""
    rows = await conn.fetch(
        """
        WITH due AS (
            SELECT event_id
            FROM automation_event_inbox
            WHERE (status IN ('received','failed') OR (status='dispatching' AND updated_at <= now()-interval '5 minutes'))
              AND next_attempt_at <= now()
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT $1
        )
        UPDATE automation_event_inbox inbox
        SET status='dispatching', attempt_count=attempt_count+1, updated_at=now()
        FROM due
        WHERE inbox.event_id=due.event_id
        RETURNING inbox.event_id, inbox.tenant_id, inbox.user_id, inbox.event_type,
                  inbox.source, inbox.occurred_at, inbox.payload, inbox.attempt_count
        """,
        limit,
    )
    dispatched = failed = matched = 0
    for row in rows:
        try:
            matched += await _dispatch_one(conn, row)
            dispatched += 1
        except Exception as exc:  # noqa: BLE001 - durable retry path
            failed += 1
            logger.exception("automation event dispatch failed for %s", row["event_id"])
            await conn.execute(
                """
                UPDATE automation_event_inbox
                SET status='failed', last_error=$4,
                    next_attempt_at=now() + (LEAST(attempt_count, 8) * interval '30 seconds'),
                    updated_at=now()
                WHERE event_id=$1 AND tenant_id=$2 AND user_id=$3
                """,
                row["event_id"], row["tenant_id"], row["user_id"], str(exc)[:1000],
            )
    return {"claimed": len(rows), "dispatched": dispatched, "failed": failed, "matched": matched}
