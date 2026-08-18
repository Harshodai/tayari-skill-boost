"""Celery application and worker lifecycle telemetry for Tayari."""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any

from celery import Celery
from celery.signals import before_task_publish, task_failure, task_postrun, task_prerun

from app.telemetry import metrics

logger = logging.getLogger("tayari.celery")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "tayari",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.scraping", "app.tasks.automation", "app.tasks.agent_automation", "app.tasks.automation_events", "app.tasks.learning", "app.tasks.delivery"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    task_default_queue="tayari",
    worker_prefetch_multiplier=1,
    task_time_limit=900,
    task_soft_time_limit=720,
    result_expires=86400,
    beat_schedule={
        "preference-learning-daily": {
            "task": "learning.run_preference_learning_all",
            "schedule": 60 * 60 * 24,
        },
        "standing-job-watches-hourly": {
            "task": "autopilot.run_standing_job_watches",
            "schedule": 60 * 60,
        },
        "nightly-db-backup": {
            "task": "system.nightly_database_backup",
            "schedule": 60 * 60 * 24,
        },
        "delivery-ledger-dispatch": {
            "task": "delivery.dispatch_pending_messages",
            "schedule": 30,
        },
        "automation-scheduled-event-emission": {
            "task": "automation.emit_scheduled_events",
            "schedule": 15,
        },
        "automation-event-dispatch": {
            "task": "automation.dispatch_events",
            "schedule": 15,
        },
        "automation-checkpoint-dispatch": {
            "task": "automation.dispatch_checkpoints",
            "schedule": 15,
        },
    },
)

_task_started: dict[str, tuple[float, float]] = {}
_task_lock = threading.Lock()


def _event(event: str, **fields: Any) -> None:
    payload = {"event": event, **fields}
    logger.info(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def _task_id(task_id: str | None) -> str:
    return str(task_id or "unknown")


def _headers_from_request(request: Any) -> dict[str, Any]:
    headers = getattr(request, "headers", None) or {}
    return headers if isinstance(headers, dict) else dict(headers)


def _enqueued_at(headers: dict[str, Any]) -> float | None:
    raw = headers.get("tayari_enqueued_at") or headers.get("sent_at")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


@before_task_publish.connect(weak=False)
def _mark_task_enqueued(headers: dict[str, Any] | None = None, **_: Any) -> None:
    """Stamp published messages so a worker can measure broker wait time."""
    if headers is not None:
        headers.setdefault("tayari_enqueued_at", time.time())


@task_prerun.connect(weak=False)
def _record_task_prerun(task_id: str | None = None, task: Any = None, **_: Any) -> None:
    request = getattr(task, "request", None)
    headers = _headers_from_request(request)
    enqueued_at = _enqueued_at(headers)
    now = time.time()
    queue_age = max(0.0, now - enqueued_at) if enqueued_at is not None else 0.0
    identifier = _task_id(task_id)
    with _task_lock:
        _task_started[identifier] = (time.monotonic(), queue_age)
    metrics.record_queue_age(queue_age)
    _event(
        "celery_task_prerun",
        task_id=identifier,
        task_name=getattr(task, "name", "unknown"),
        queue_age_seconds=round(queue_age, 3),
    )


def _finish_task(task_id: str | None) -> tuple[float, float]:
    identifier = _task_id(task_id)
    with _task_lock:
        started = _task_started.pop(identifier, None)
    if started is None:
        return 0.0, 0.0
    started_at, queue_age = started
    return max(0.0, time.monotonic() - started_at), queue_age


@task_postrun.connect(weak=False)
def _record_task_postrun(
    task_id: str | None = None,
    task: Any = None,
    state: str | None = None,
    **_: Any,
) -> None:
    duration, queue_age = _finish_task(task_id)
    metrics.increment("tasks_completed_total")
    _event(
        "celery_task_postrun",
        task_id=_task_id(task_id),
        task_name=getattr(task, "name", "unknown"),
        state=state or "unknown",
        queue_age_seconds=round(queue_age, 3),
        task_duration_seconds=round(duration, 3),
    )


@task_failure.connect(weak=False)
def _record_task_failure(
    task_id: str | None = None,
    task: Any = None,
    exception: BaseException | None = None,
    **_: Any,
) -> None:
    identifier = _task_id(task_id)
    with _task_lock:
        started = _task_started.get(identifier)
    duration = max(0.0, time.monotonic() - started[0]) if started else 0.0
    queue_age = started[1] if started else 0.0
    metrics.increment("task_failures_total")
    _event(
        "celery_task_failure",
        task_id=identifier,
        task_name=getattr(task, "name", "unknown"),
        exception_type=type(exception).__name__ if exception else "unknown",
        queue_age_seconds=round(queue_age, 3),
        task_duration_seconds=round(duration, 3),
    )


__all__ = ["celery_app", "REDIS_URL"]
