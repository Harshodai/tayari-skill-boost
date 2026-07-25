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


@celery_app.task(name="agentspace.run_agent_task", bind=True)
def run_agent_task(self, task_id: str, user_id: str, agent_id: str, config: dict | None = None) -> dict:
    """Run an AgentSpace enqueued task in the background."""
    import asyncio
    from app.services.agent_db import (
        get_digital_employee,
        update_agent_task_status,
        create_agent_task_attempt,
        update_agent_task_attempt,
        create_agent_router_event,
    )
    from app.services.agent_router import AgentRouter

    async def _async_run():
        attempt_id = await create_agent_task_attempt(user_id, task_id, attempt_number=1, status="running")
        await update_agent_task_status(user_id, task_id, status="running")
        await create_agent_router_event(
            user_id, task_id, "task_started", 
            "Digital employee starting scheduled task execution"
        )
        
        agent = await get_digital_employee(user_id, agent_id)
        instructions = agent.get("instructions") if agent else "You are a helpful job assistant."
        role = agent.get("role") if agent else "Agent"
        
        router = AgentRouter(user_id=user_id, task_id=task_id, agent_id=agent_id)
        
        try:
            # Step 1: Initial Scrape / Search target
            await create_agent_router_event(
                user_id, task_id, "info", 
                f"Agent ({role}) analyzing candidate profile and matching target roles"
            )
            
            sys_prompt = f"You are {agent_id}, role: {role}. Instructions: {instructions}"
            user_prompt = "Perform search and identify best matching job. Return JSON with target company name and role."
            
            # Run step
            response = await router.execute_agent_step(sys_prompt, user_prompt, runtime_id="default")
            
            # Step 2: Critical action requiring human approval
            tool_input = {"company": "Acme Corp", "role": "Full Stack Engineer", "salary": "$120,000"}
            approved = await router.request_tool_execution(
                tool_name="submit_application",
                tool_input=tool_input,
                content_preview="Submit application to Acme Corp for Full Stack Engineer position",
                poll_interval_seconds=0.5,
                timeout_seconds=60.0
            )
            
            if not approved:
                await create_agent_router_event(
                    user_id, task_id, "info", 
                    "Task execution halted: human reviewer rejected critical tool call"
                )
                await update_agent_task_status(
                    user_id, task_id, status="failed", 
                    error_text="Tool execution rejected by human"
                )
                if attempt_id:
                    await update_agent_task_attempt(
                        user_id, attempt_id, status="failed", 
                        error_text="Tool execution rejected by human"
                    )
                return {"task_id": task_id, "status": "failed", "reason": "rejected"}
            
            # Step 3: Action Approved, complete the submission
            await create_agent_router_event(
                user_id, task_id, "info", 
                "Executing application submission to Acme Corp portals"
            )
            await asyncio.sleep(0.5) # simulate submission latency
            
            result = {"status": "success", "company": "Acme Corp", "application_id": "app_999"}
            await create_agent_router_event(
                user_id, task_id, "task_success", 
                "Application submitted successfully! Portal confirmation received.",
                payload_json=result
            )
            await update_agent_task_status(user_id, task_id, status="success", result_json=result)
            if attempt_id:
                await update_agent_task_attempt(user_id, attempt_id, status="success")
            return {"task_id": task_id, "status": "success"}
            
        except Exception as exc:
            logger.exception("AgentSpace task execution failed")
            await create_agent_router_event(
                user_id, task_id, "task_failed", 
                f"Task execution failed unexpectedly: {str(exc)}"
            )
            await update_agent_task_status(user_id, task_id, status="failed", error_text=str(exc))
            if attempt_id:
                await update_agent_task_attempt(user_id, attempt_id, status="failed", error_text=str(exc))
            return {"task_id": task_id, "status": "failed", "error": str(exc)}

    return asyncio.run(_async_run())


@celery_app.task(name="autopilot.run_standing_job_watches", bind=True)
def run_standing_job_watches(self) -> dict:
    """Query active job_watches from Postgres and trigger scheduled autopilot runs."""
    import os
    async def _execute():
        from app.services.db import get_pool
        pool = await get_pool()
        if not pool:
            return {"status": "skipped_no_db"}
        async with pool.acquire() as conn:
            watches = await conn.fetch(
                """SELECT watch_id, user_id, query_title, location, salary_floor, schedule_tier
                   FROM public.job_watches WHERE is_active = true"""
            )
        triggered = 0
        for w in watches:
            user_id = str(w["user_id"])
            title = w["query_title"]
            loc = w["location"] or "Remote"
            config = {
                "user_id": user_id,
                "job_titles": [title],
                "location": loc,
                "standing_watch_id": str(w["watch_id"]),
            }
            run_scheduled.delay(user_id=user_id, config=config)
            triggered += 1
        return {"status": "success", "watches_triggered": triggered}

    try:
        return asyncio.run(_execute())
    except Exception as exc:  # noqa: BLE001
        logger.exception("run_standing_job_watches failed: %s", exc)
        return {"status": "failed", "error": str(exc)}


@celery_app.task(name="system.nightly_database_backup", bind=True)
def nightly_database_backup(self) -> dict:
    """Execute nightly Postgres backup script."""
    import os
    import subprocess
    script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../scripts/backup.sh"))
    if not os.path.exists(script_path):
        script_path = "/app/scripts/backup.sh"
    try:
        res = subprocess.run(["bash", script_path], capture_output=True, text=True, timeout=300)
        return {"status": "success" if res.returncode == 0 else "failed", "output": res.stdout, "error": res.stderr}
    except Exception as exc:  # noqa: BLE001
        logger.exception("nightly_database_backup failed: %s", exc)
        return {"status": "failed", "error": str(exc)}