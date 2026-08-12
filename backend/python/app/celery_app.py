"""Celery application for Tayari background tasks.

Broker and result backend both use Redis (``REDIS_URL`` from env, default
``redis://redis:6379/0``). Tasks live in :mod:`app.tasks.scraping` and
:mod:`app.tasks.automation`. The worker image (``Dockerfile.worker``) runs
this app with queue ``tayari`` and concurrency 4.

Config notes:
- ``task_acks_late`` + ``task_reject_on_worker_lost`` so a crashed worker
  re-delivers in-flight tasks instead of dropping them.
- ``worker_prefetch_multiplier=1`` avoids one worker hogging a batch of
  long-running scrape/apply tasks.
- 15m hard / 12m soft time limit bounds a stuck provider.
"""
from __future__ import annotations

import os

from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "tayari",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.scraping", "app.tasks.automation", "app.tasks.learning", "app.tasks.delivery"],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Reliability
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    # Queue + worker
    task_default_queue="tayari",
    worker_prefetch_multiplier=1,
    # Time limits (seconds): 15m hard, 12m soft
    task_time_limit=900,
    task_soft_time_limit=720,
    # Results
    result_expires=86400,
    # Scheduled beat tasks: preference learning, job watches, nightly backups
    beat_schedule={
        "preference-learning-daily": {
            "task": "learning.run_preference_learning_all",
            "schedule": 60 * 60 * 24,  # 24h
        },
        "standing-job-watches-hourly": {
            "task": "autopilot.run_standing_job_watches",
            "schedule": 60 * 60,  # 1h
        },
        "nightly-db-backup": {
            "task": "system.nightly_database_backup",
            "schedule": 60 * 60 * 24,  # 24h
        },
        # The ledger is idempotent and candidate-scoped; provider credentials
        # and channel opt-in are still required before any external delivery.
        "delivery-ledger-dispatch": {
            "task": "delivery.dispatch_pending_messages",
            "schedule": 30,
        },
    },
)

__all__ = ["celery_app", "REDIS_URL"]