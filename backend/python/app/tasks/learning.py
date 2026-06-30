"""Celery task: daily preference learning across all users with feedback.

``learning.run_preference_learning_task`` wraps
:func:`preference_learning.run_preference_learning` for a single user under
``asyncio.run``. ``learning.run_preference_learning_all`` scans
``user_job_feedback`` for distinct user_ids and enqueues a per-user task.

Registered on queue ``tayari``. Everything degrades to a no-op when
``DATABASE_URL`` is unset or asyncpg is absent.
"""
from __future__ import annotations

import asyncio
import logging

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="learning.run_preference_learning_task", bind=True, queue="tayari")
def run_preference_learning_task(self, user_id: str) -> dict:
    """Compute + persist one user's preference profile."""
    try:
        from app.services.preference_learning import run_preference_learning
        return _safe_async(run_preference_learning(user_id))
    except Exception as exc:  # noqa: BLE001
        logger.warning("learning.run_preference_learning_task failed (%s): %s", user_id, exc)
        return {"user_id": user_id, "error": str(exc)}


@celery_app.task(name="learning.run_preference_learning_all", queue="tayari")
def run_preference_learning_all() -> dict:
    """Fan out preference learning to every user with feedback rows."""
    async def _go() -> dict:
        from app.services.db import get_pool
        pool = await get_pool()
        if not pool:
            return {"enqueued": 0, "skipped": "db_disabled"}
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT DISTINCT user_id::text AS uid FROM user_job_feedback"
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("learning.run_preference_learning_all fetch failed: %s", exc)
            return {"enqueued": 0, "error": str(exc)}

        user_ids = [r["uid"] for r in rows if r["uid"]]
        for uid in user_ids:
            run_preference_learning_task.delay(uid)
        return {"enqueued": len(user_ids)}

    try:
        return _safe_async(_go())
    except Exception as exc:  # noqa: BLE001
        logger.warning("learning.run_preference_learning_all failed: %s", exc)
        return {"enqueued": 0, "error": str(exc)}


def _safe_async(coro) -> dict:
    """Run an async coroutine to completion under a fresh loop; return dict."""
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("learning._safe_async failed: %s", exc)
        return {"error": str(exc)}