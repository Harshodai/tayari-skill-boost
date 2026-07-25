# ADR-0001: Single Clock Architecture (Celery Beat)

## Status
Accepted

## Context
Tayari previously used a split-brain clock architecture for periodic automations:
1. An `asyncio` scheduler loop running inside the FastAPI lifespan (`main.py` -> `scheduler_loop`).
2. An inert `beat_schedule` configuration inside Celery (`celery_app.py`) without a running Beat daemon.

This split-brain architecture caused multiple operational risks:
- The in-process `asyncio` loop died whenever the API pod restarted or scale-down occurred.
- Lacked a distributed advisory lock, risking duplicate task execution across multiple API instances.
- Tasks running in the in-process loop were invisible to Celery monitoring tools like Flower.
- `company_radar.py` was unassigned and scheduled by neither clock.

## Decision
We consolidate **ALL** periodic, recurring, and background scheduled work into a single **Celery Beat** service (`celery-beat` compose service).

1. Add a dedicated `celery-beat` service container in `docker-compose.yml` (`command: celery -A app.celery_app beat`).
2. Migrate all periodic jobs (standing interest watches, ATS scans, company radar checks, follow-up cadences, daily digests, and preference learning) to Celery tasks registered in `beat_schedule`.
3. Deprecate and remove the in-process `asyncio` lifespan scheduler loop in `main.py` to prevent duplicate-fire risks and eliminate split-brain scheduling.

## Consequences
- **Positive**: Single source of truth for scheduling. Survived API restarts. Fully observable via Flower dashboard. Note: Centralized Celery Beat provides single-clock task dispatch, but task idempotency and task-level distributed locking remain separate requirements. Currently, standing interest watch dispatch (`run_standing_watches`) and daily digest generation (`send_daily_digests`) satisfy task idempotency via Redis deduplication locks and event TTL tracking.
- **Negative**: Requires running the `celery-beat` sidecar service container in Docker environments.
