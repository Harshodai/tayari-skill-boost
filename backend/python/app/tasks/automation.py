"""Celery tasks: Auto-Pilot application agent + scheduled runs.

``autopilot.run_application_agent`` wraps :func:`automation_engine.run_autopilot`
under ``asyncio.run``, persists an ``agent_runs`` row
(run_type='application_agent', parent = the originating autopilot run when
known), and returns ``{run_id, status}``.

``autopilot.run_scheduled`` loads a user's profile + most recent resume from
Postgres and enqueues ``run_application_agent``. All DB access is guarded:
when ``DATABASE_URL`` is unset or the load fails, the task degrades to an
empty profile/resume rather than raising.
"""
from __future__ import annotations

import asyncio
import logging
import uuid

from app.celery_app import celery_app
from app.services.db import (
    append_log,
    create_agent_run,
    load_agent_run,
    update_agent_run,
)

logger = logging.getLogger(__name__)


@celery_app.task(name="autopilot.run_application_agent", bind=True)
def run_application_agent(self, run_id: str, config: dict, profile: dict | None,
                          resume_text: str, candidate_name: str = "Candidate") -> dict:
    """Run the autopilot application pipeline for one configured run.

    Persists an ``agent_runs`` row (run_type='application_agent') at start,
    links it to the originating autopilot run when ``config`` carries one,
    and updates status to completed/failed at the end. Returns
    ``{run_id, status}``.
    """
    from app.services import automation_engine

    parent_run_id = config.get("autopilot_run_id") or config.get("parent_run_id")
    user_id = config.get("user_id")
    celery_task_id = self.request.id

    _persist_start(run_id, user_id, parent_run_id, celery_task_id, config)
    status = "failed"
    try:
        asyncio.run(automation_engine.run_autopilot(
            run_id, config, profile, resume_text, candidate_name,
        ))
        run_state = automation_engine.get_run_status(run_id) or {}
        status = run_state.get("status", "completed")
    except Exception as exc:  # noqa: BLE001 - never lose the failure
        logger.exception("run_application_agent %s failed", run_id)
        _persist_final(run_id, status="failed", error=str(exc))
        return {"run_id": run_id, "status": "failed"}

    _persist_final(run_id, status=status)
    return {"run_id": run_id, "status": status}


@celery_app.task(name="autopilot.run_scheduled", bind=True)
def run_scheduled(self, user_id: str, config: dict | None = None) -> dict:
    """Load profile+resume for ``user_id`` and enqueue an application run.

    Best-effort DB load: when unavailable, enqueues with empty profile/resume
    so the worker still receives a runnable task. Returns the enqueued
    ``run_id`` and ``task_id``.
    """
    config = dict(config or {})
    config.setdefault("user_id", user_id)
    profile, resume_text, candidate_name = _load_user_context(user_id)
    run_id = str(uuid.uuid4())
    task = run_application_agent.apply_async(
        args=(run_id, config, profile, resume_text, candidate_name),
        queue="tayari",
    )
    logger.info("run_scheduled: enqueued %s for user %s as %s",
                run_id, user_id, task.id)
    return {"run_id": run_id, "task_id": task.id}


@celery_app.task(name="autopilot.run_scheduled_autopilot", bind=True)
def run_scheduled_autopilot(self, schedule_id: str, user_id: str,
                            config: dict | None = None) -> dict:
    """Enqueue an application-agent run for a due schedule.

    Called by the Python scheduler's ``_trigger_scheduled_run`` with the
    schedule_id + user_id read from ``autopilot_schedules``. Loads the user's
    profile/resume (best-effort), stamps ``schedule_id``/``user_id`` into the
    config, and enqueues ``run_application_agent``. Returns the enqueued
    ``run_id``/``task_id``.
    """
    config = dict(config or {})
    config.setdefault("user_id", user_id)
    config.setdefault("schedule_id", schedule_id)
    profile, resume_text, candidate_name = _load_user_context(user_id)
    run_id = str(uuid.uuid4())
    task = run_application_agent.apply_async(
        args=(run_id, config, profile, resume_text, candidate_name),
        queue="tayari",
    )
    logger.info("run_scheduled_autopilot: enqueued %s for schedule %s user %s as %s",
                run_id, schedule_id, user_id, task.id)
    return {"run_id": run_id, "task_id": task.id}


# ---------------------------------------------------------------------------
# Helpers (each <50 lines; DB-guarded)
# ---------------------------------------------------------------------------

def _persist_start(run_id: str, user_id: str | None, parent_run_id: str | None,
                   celery_task_id: str | None, config: dict) -> None:
    """Record the start of an application_agent run (best-effort)."""
    async def _go() -> None:
        await create_agent_run(
            run_id=run_id, user_id=user_id, run_type="application_agent",
            config=config, parent_run_id=parent_run_id,
            celery_task_id=celery_task_id, engine="autopilot",
        )
        await append_log(run_id, "START", "Application agent starting")
    _safe_async(_go())


def _persist_final(run_id: str, status: str, error: str | None = None) -> None:
    """Record the terminal status of an application_agent run."""
    fields = {"status": status, "progress": 100 if status == "completed" else 0}
    if error:
        fields["error"] = error
    if status == "completed":
        from datetime import datetime, timezone
        fields["completed_at"] = datetime.now(timezone.utc).isoformat()
    async def _go() -> None:
        await update_agent_run(run_id, **fields)
    _safe_async(_go())


def _load_user_context(user_id: str) -> tuple[dict | None, str, str]:
    """Load profile + most recent resume for ``user_id`` from Postgres.

    Returns ``(profile, resume_text, candidate_name)``. Any failure or
    missing DB yields ``(None, "", "Candidate")``.
    """
    async def _load() -> tuple[dict | None, str, str]:
        from app.services.db import get_pool
        pool = await get_pool()
        if not pool:
            return None, "", "Candidate"
        async with pool.acquire() as conn:
            prof = await conn.fetchrow(
                """SELECT full_name, headline, summary, skills, desired_roles,
                          locations, experience_years, open_to_remote
                   FROM profiles WHERE id = $1""",
                user_id,
            )
            resume = await conn.fetchrow(
                """SELECT resume_text FROM resume_analyses
                   WHERE user_id = $1 AND resume_text IS NOT NULL
                   ORDER BY created_at DESC LIMIT 1""",
                user_id,
            )
        profile = dict(prof) if prof else None
        resume_text = (resume["resume_text"] if resume else "") or ""
        candidate_name = (profile or {}).get("full_name") or "Candidate"
        return profile, resume_text, candidate_name

    try:
        return asyncio.run(_load())
    except Exception as exc:  # noqa: BLE001 - DB optional
        logger.warning("run_scheduled: user context load failed (%s)", exc)
        return None, "", "Candidate"


def _safe_async(coro) -> None:
    """Run an async persistence coroutine to completion; swallow DB failures."""
    try:
        asyncio.run(coro)
    except Exception as exc:  # noqa: BLE001 - persistence must not break tasks
        logger.debug("automation task DB persist skipped (%s)", exc)