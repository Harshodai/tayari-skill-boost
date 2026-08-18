"""Celery task for durable automation event routing."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.celery_app import celery_app
from app.services.capabilities import Capability, capability_enabled
from app.services.automation_events import dispatch_due_events, emit_scheduled_events

logger = logging.getLogger(__name__)


async def _dispatch() -> dict[str, Any]:
    if not capability_enabled(Capability.WORKSPACE_AUTOMATIONS):
        return {"status": "disabled_by_launch_scope", "claimed": 0, "dispatched": 0, "failed": 0, "matched": 0}
    from app.services.db import get_pool

    pool = await get_pool()
    if not pool:
        return {"status": "skipped_no_db", "claimed": 0, "dispatched": 0, "failed": 0, "matched": 0}
    async with pool.acquire() as conn:
        async with conn.transaction():
            result = await dispatch_due_events(conn)
    return {"status": "ok", **result}


async def _emit_scheduled() -> dict[str, Any]:
    if not capability_enabled(Capability.WORKSPACE_AUTOMATIONS):
        return {"status": "disabled_by_launch_scope", "tenants": 0, "emitted": 0, "duplicates": 0}
    from app.services.db import get_pool

    pool = await get_pool()
    if not pool:
        return {"status": "skipped_no_db", "tenants": 0, "emitted": 0, "duplicates": 0}
    async with pool.acquire() as conn:
        async with conn.transaction():
            result = await emit_scheduled_events(conn)
    return {"status": "ok", **result}


@celery_app.task(name="automation.emit_scheduled_events", bind=True)
def emit_scheduled(self) -> dict[str, Any]:
    """Emit deterministic recurring events for active tenant automations."""
    try:
        return asyncio.run(_emit_scheduled())
    except Exception as exc:  # noqa: BLE001 - scheduler must report failure
        logger.exception("scheduled automation event emission failed")
        return {"status": "failed", "error": str(exc), "tenants": 0, "emitted": 0, "duplicates": 0}


@celery_app.task(name="automation.dispatch_events", bind=True)
def dispatch_events(self) -> dict[str, Any]:
    """Route durable event envelopes to active automation definitions."""
    try:
        return asyncio.run(_dispatch())
    except Exception as exc:  # noqa: BLE001 - worker must report a durable failure
        logger.exception("automation event dispatch failed")
        return {"status": "failed", "error": str(exc), "claimed": 0, "dispatched": 0, "failed": 1, "matched": 0}
