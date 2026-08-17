"""Production contracts for Celery acknowledgement, retry, and scheduling semantics."""
from __future__ import annotations

from app.celery_app import celery_app
from app.tasks.delivery import dispatch_pending_messages


REQUIRED_BEAT_TASKS = {
    "preference-learning-daily": ("learning.run_preference_learning_all", 24 * 60 * 60),
    "standing-job-watches-hourly": ("autopilot.run_standing_job_watches", 60 * 60),
    "nightly-db-backup": ("system.nightly_database_backup", 24 * 60 * 60),
    "delivery-ledger-dispatch": ("delivery.dispatch_pending_messages", 30),
}


def test_worker_lost_tasks_are_requeued_before_acknowledgement() -> None:
    """A worker crash must leave the broker message eligible for redelivery."""
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.task_reject_on_worker_lost is True
    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.task_track_started is True


def test_delivery_dispatch_has_bounded_automatic_retries() -> None:
    """Durable delivery retries must be explicit and bounded, not infinite."""
    assert dispatch_pending_messages.autoretry_for == (Exception,)
    assert dispatch_pending_messages.retry_backoff is True
    assert dispatch_pending_messages.retry_kwargs["max_retries"] == 3


def test_required_beat_schedule_is_complete_and_valid() -> None:
    schedule = celery_app.conf.beat_schedule
    assert set(schedule) >= set(REQUIRED_BEAT_TASKS)
    for entry_name, (task_name, interval) in REQUIRED_BEAT_TASKS.items():
        entry = schedule[entry_name]
        assert entry["task"] == task_name
        assert isinstance(entry["schedule"], (int, float))
        assert entry["schedule"] == interval
        assert entry["schedule"] > 0
