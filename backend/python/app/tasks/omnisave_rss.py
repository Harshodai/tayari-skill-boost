"""Celery task: background RSS polling for watched Substack publications.

Substack is the one OmniSave platform where a candidate's ongoing content
can be kept in sync without a browser tab open at all — it publishes a
public per-publication RSS feed, unlike LinkedIn/Medium which expose no
feed for a user's saved/reading content and stay dependent on the
browser-companion extension. See ``OmnisaveService.poll_due_substack_watches``
for the actual fetch-and-ingest logic; this task only runs it under
``asyncio.run`` on a fixed beat interval, same pattern as ``app.tasks.scraping``.
"""
from __future__ import annotations

import asyncio
import logging

from app.celery_app import celery_app
from app.services.omnisave_service import get_omnisave_service

logger = logging.getLogger(__name__)


def _run_poll(limit: int) -> dict:
    async def _poll() -> dict:
        service = get_omnisave_service()
        return await service.poll_due_substack_watches(limit=limit)

    return asyncio.run(_poll())


@celery_app.task(name="omnisave.poll_substack_watches", bind=True)
def poll_substack_watches(self, limit: int = 25) -> dict:
    """Poll the least-recently-polled watched Substack publications.

    Returns ``{"polled": int, "ingested": int}``. Never raises — a failed
    fetch for one publication is recorded on that row (last_poll_status,
    last_poll_error) and does not block the others; this task itself only
    fails if the database is unreachable for the whole batch.
    """
    try:
        result = _run_poll(limit)
    except Exception as exc:  # noqa: BLE001
        logger.error("omnisave.poll_substack_watches failed: %s", exc)
        raise
    if result.get("polled"):
        logger.info(
            "omnisave.poll_substack_watches: polled %s publication(s), ingested %s new post(s)",
            result.get("polled"),
            result.get("ingested"),
        )
    return result
