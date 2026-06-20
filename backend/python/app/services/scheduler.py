from __future__ import annotations
"""Recurring Auto-Pilot scheduler.

A lightweight asyncio loop checks due schedules every ``CHECK_INTERVAL_SECONDS``
and enqueues a Celery ``run_scheduled_autopilot`` task per due row. Schedules
are persisted by the Go backend in the shared ``autopilot_schedules`` Postgres
table; the Python scheduler reads that table read-only (no auth duplication)
and updates only ``next_run_at``/``last_run_at`` after enqueueing.

In-memory schedule helpers (``create_schedule``/``list_schedules``/...) remain
for backward compatibility and tests without a DB.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from app.services.automation_engine import run_autopilot

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 300
FREQUENCY_DELTAS = {
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
    "biweekly": timedelta(weeks=2),
}

# In-memory schedules store (Go backend persists actual schedules in Postgres).
_schedules: list = []


def next_run_time(frequency: str) -> str:
    delta = FREQUENCY_DELTAS.get(frequency, FREQUENCY_DELTAS["daily"])
    return (datetime.now(timezone.utc) + delta).isoformat()


def create_schedule(user_id: str, frequency: str, config: dict) -> dict:
    schedule = {
        "schedule_id": str(uuid.uuid4()),
        "user_id": user_id,
        "frequency": frequency,
        "config": config,
        "active": True,
        "next_run_at": next_run_time(frequency),
        "last_run_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _schedules.append(schedule)
    return schedule


def list_schedules(user_id: str) -> list:
    return [s for s in _schedules if s.get("user_id") == user_id]


def toggle_schedule(schedule_id: str, user_id: str, active: bool) -> dict | None:
    for s in _schedules:
        if s["schedule_id"] == schedule_id and s["user_id"] == user_id:
            s["active"] = active
            return s
    return None


def delete_schedule(schedule_id: str, user_id: str) -> bool:
    global _schedules
    original = len(_schedules)
    _schedules = [s for s in _schedules
                  if not (s["schedule_id"] == schedule_id and s["user_id"] == user_id)]
    return len(_schedules) < original


# ---------------------------------------------------------------------------
# Async profile/resume loaders (read-only Postgres via the shared pool)
# ---------------------------------------------------------------------------

async def _load_profile_for_user(user_id: str) -> dict | None:
    """Load a user's profile row from Postgres. None when DB off/missing."""
    from app.services.db import get_pool
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT full_name, headline, summary, skills, desired_roles,
                          locations, experience_years, open_to_remote
                   FROM profiles WHERE id = $1""",
                user_id,
            )
        return dict(row) if row else None
    except Exception as exc:  # noqa: BLE001 - DB optional
        logger.warning("scheduler: profile load failed for %s (%s)", user_id, exc)
        return None


async def _load_resume_for_user(user_id: str) -> str:
    """Load the user's most recent resume text.

    Reads from ``resume_analyses`` (most recent non-null ``resume_text``).
    Returns ``""`` when the DB is off or no resume is found. Documented: this
    intentionally does not read ``profiles.links`` (no canonical resume field
    there); ``resume_analyses`` is the simplest viable source.
    """
    from app.services.db import get_pool
    pool = await get_pool()
    if not pool:
        return ""
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT resume_text FROM resume_analyses
                   WHERE user_id = $1 AND resume_text IS NOT NULL
                   ORDER BY created_at DESC LIMIT 1""",
                user_id,
            )
        return (row["resume_text"] if row else "") or ""
    except Exception as exc:  # noqa: BLE001 - DB optional
        logger.warning("scheduler: resume load failed for %s (%s)", user_id, exc)
        return ""


async def _maybe_await(fn, *args):
    """Call ``fn`` and await its result when it's a coroutine, else return it."""
    result = fn(*args) if callable(fn) else fn
    if asyncio.iscoroutine(result):
        return await result
    return result


# ---------------------------------------------------------------------------
# DB-backed due-schedule processing
# ---------------------------------------------------------------------------

async def _load_due_schedules() -> list[dict]:
    """Read active due schedules from the shared Postgres table.

    Returns a list of dict rows or ``[]`` when the DB is unavailable.
    """
    from app.services.db import get_pool
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT schedule_id, user_id, frequency, config,
                          next_run_at, last_run_at
                   FROM autopilot_schedules
                   WHERE active = true AND next_run_at <= now()"""
            )
        return [dict(r) for r in rows]
    except Exception as exc:  # noqa: BLE001 - DB optional
        logger.warning("scheduler: due-schedule load failed (%s)", exc)
        return []


async def _mark_schedule_run(schedule_id, next_run: str) -> bool:
    """Update next_run_at + last_run_at for an enqueued schedule (guarded)."""
    from app.services.db import get_pool
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE autopilot_schedules
                   SET next_run_at = $2::timestamptz,
                       last_run_at = now(),
                       updated_at = now()
                   WHERE schedule_id = $1 AND active = true""",
                schedule_id, next_run,
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("scheduler: mark run failed for %s (%s)", schedule_id, exc)
        return False


async def _trigger_scheduled_run(schedule: dict, profile: dict | None,
                                 resume_text: str, candidate_name: str = "Candidate") -> None:
    """Enqueue a Celery ``run_scheduled_autopilot`` task for a due schedule.

    Falls back to an in-process ``run_autopilot`` task when Celery is absent
    (e.g. keyless/local dev) so the scheduler never hard-fails.
    """
    schedule_id = schedule["schedule_id"]
    user_id = schedule["user_id"]
    config = dict(schedule.get("config") or {})
    config.setdefault("user_id", user_id)
    config.setdefault("schedule_id", schedule_id)
    try:
        from app.tasks.automation import run_scheduled_autopilot
        run_scheduled_autopilot.apply_async(
            (schedule_id, user_id, config), queue="tayari",
        )
        logger.info("Scheduled Auto-Pilot enqueued for schedule %s (user %s)",
                    schedule_id, user_id)
    except ImportError:
        # Celery/tasks unavailable: run in-process as a background task.
        logger.info("Celery unavailable; running autopilot in-process for %s", schedule_id)
        run_id = str(uuid.uuid4())
        asyncio.create_task(run_autopilot(run_id, config, profile, resume_text, candidate_name))
    except Exception as exc:  # noqa: BLE001 - enqueue failure must not kill the loop
        logger.error("scheduler: enqueue failed for %s (%s); running in-process",
                     schedule_id, exc)
        run_id = str(uuid.uuid4())
        asyncio.create_task(run_autopilot(run_id, config, profile, resume_text, candidate_name))


async def scheduler_loop(profile_provider=None, resume_provider=None) -> None:
    """Background loop — started once on app startup.

    Each tick reads due schedules from Postgres (shared ``autopilot_schedules``
    table, written by the Go backend), loads each user's profile/resume via
    the async providers, enqueues a Celery task per due schedule, and bumps
    ``next_run_at``/``last_run_at``. When no DB is configured the loop is a
    no-op that sleeps and retries.
    """
    logger.info("Auto-Pilot scheduler started (interval: %ss)", CHECK_INTERVAL_SECONDS)
    while True:
        try:
            await _tick(profile_provider, resume_provider)
        except Exception as exc:  # noqa: BLE001 - never let one tick kill the loop
            logger.error("Scheduler tick failed: %s", exc)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


async def _tick(profile_provider=None, resume_provider=None) -> None:
    """One scheduler tick: load due schedules, enqueue, bump next_run_at."""
    due = await _load_due_schedules()
    if not due:
        return
    for schedule in due:
        user_id = schedule["user_id"]
        profile = await _maybe_await(profile_provider, user_id) if profile_provider else None
        resume_text = await _maybe_await(resume_provider, user_id) if resume_provider else ""
        await _trigger_scheduled_run(schedule, profile, resume_text)
        await _mark_schedule_run(schedule["schedule_id"], next_run_time(schedule["frequency"]))