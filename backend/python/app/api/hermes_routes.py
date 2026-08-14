"""Hermes HTTP endpoints — scrape, cached jobs, and agent_run status.

All four routes live behind ``/api/v1/hermes`` and degrade gracefully when the
DB (``agent_runs``) or Celery broker is unavailable:

- ``POST /scrape``        — sync inline scrape or async Celery enqueue (run_id).
- ``GET  /jobs/{board}``   — most recent cached jobs for a board class.
- ``GET  /runs``          — list ``agent_runs`` rows (filtered).
- ``GET  /runs/{run_id}`` — single ``agent_runs`` detail (logs + screenshots).

The ``logs`` entries keep the existing ``{step, message, at}`` shape so the Go
``LogEntrySlice`` consumer needs no change.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.services import db as db_service
from app.services.hermes import HermesScraper
from app.services.hermes.cache import list_by_board

logger = logging.getLogger(__name__)

hermes_router = APIRouter(prefix="/api/v1/hermes", tags=["hermes"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class HermesScrapeRequest(BaseModel):
    """Body for ``POST /api/v1/hermes/scrape``.

    ``sync=True`` runs the scrape inline (best-effort agent_runs row written);
    ``sync=False`` (default) enqueues a Celery task and returns a ``run_id`` +
    ``task_id`` immediately so the caller can poll ``GET /runs/{run_id}``.
    """

    query: str
    location: str = ""
    board: Optional[dict[str, Any]] = None
    limit: int = 40
    sync: bool = False
    run_config: Optional[dict[str, Any]] = None


class HermesScrapeSyncResponse(BaseModel):
    run_id: str
    status: str = "completed"
    count: int
    jobs: list[dict[str, Any]] = Field(default_factory=list)


class HermesScrapeAsyncResponse(BaseModel):
    run_id: str
    status: str = "queued"
    task_id: Optional[str] = None


class HermesJobsResponse(BaseModel):
    board: str
    count: int
    jobs: list[dict[str, Any]] = Field(default_factory=list)


class HermesRunDetailResponse(BaseModel):
    run_id: str
    status: Optional[str] = None
    progress: Optional[int] = None
    current_step: Optional[str] = None
    logs: list[dict[str, Any]] = Field(default_factory=list)
    screenshots: list[dict[str, Any]] = Field(default_factory=list)
    result: Optional[dict[str, Any]] = None
    engine: Optional[str] = None
    celery_task_id: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


# ---------------------------------------------------------------------------
# 1. POST /scrape
# ---------------------------------------------------------------------------

@hermes_router.post("/scrape", response_model=None)
async def hermes_scrape(payload: HermesScrapeRequest):
    """Run a Hermes scrape synchronously or enqueue it via Celery.

    When ``sync=True`` the scraper runs inline; a best-effort ``agent_runs``
    row (run_type='scrape', status='completed') is written via the guarded DB
    helpers so polling clients can see the result. When ``sync=False`` (the
    default and the recommended path) the Celery task
    ``hermes.scrape_job_board`` is enqueued and an ``agent_runs`` row with
    ``status='queued'`` is created first so polling sees it immediately.
    """
    run_id = str(uuid.uuid4())
    config = {
        "query": payload.query,
        "location": payload.location,
        "board": payload.board,
        "limit": payload.limit,
        **(payload.run_config or {}),
    }

    if payload.sync:
        return await _scrape_sync(run_id, payload, config)

    return await _scrape_async(run_id, payload, config)


async def _scrape_sync(
    run_id: str, payload: HermesScrapeRequest, config: dict[str, Any]
) -> HermesScrapeSyncResponse:
    """Run the scraper inline and persist a completed agent_runs row."""
    scraper = HermesScraper()
    jobs = await scraper.scrape(
        payload.query, payload.location, payload.board, payload.limit,
    )
    result = {"count": len(jobs), "jobs": jobs}
    # Best-effort persistence — no user context in this sync path, so the
    # create_agent_run call becomes a guarded no-op (user_id is required).
    await _persist_sync_run(run_id, config, result)
    return HermesScrapeSyncResponse(
        run_id=run_id, status="completed", count=len(jobs), jobs=jobs,
    )


async def _persist_sync_run(
    run_id: str, config: dict[str, Any], result: dict[str, Any]
) -> None:
    """Best-effort: mark a sync scrape run completed in agent_runs.

    create_agent_run requires a user_id (FK to auth.users); without one the
    helper is a no-op, which is the correct behavior for an unauthenticated
    sync scrape. We still attempt update_agent_run so any future caller that
    threads a user_id through sees the completed status.
    """
    try:
        await db_service.create_agent_run(
            run_id=run_id, user_id=None, run_type="scrape",
            config=config, engine="hermes",
        )
        await db_service.update_agent_run(
            run_id, status="completed", progress=100, result=result,
        )
    except Exception as exc:  # noqa: BLE001 - persistence must not break the API
        logger.debug("hermes.scrape sync persist skipped (%s)", exc)


async def _scrape_async(
    run_id: str, payload: HermesScrapeRequest, config: dict[str, Any]
) -> HermesScrapeAsyncResponse:
    """Enqueue the Celery scrape task; return run_id + task_id immediately.

    Falls back to a sync scrape if Celery cannot be imported or the broker is
    unreachable. An ``agent_runs`` row (status='queued', celery_task_id set)
    is created *before* the enqueue so polling clients see it even if the
    worker has not picked the task up yet.
    """
    task = _enqueue_scrape_task(payload)
    if task is None:
        logger.warning("hermes.scrape: Celery unavailable, falling back to sync")
        return await _scrape_sync(run_id, payload, config)

    # user_id is None here (no auth context threaded through yet); create_agent_run
    # is a guarded no-op without it. We still record celery_task_id for when a
    # caller does supply a user_id via a future wiring.
    try:
        await db_service.create_agent_run(
            run_id=run_id, user_id=None, run_type="scrape",
            config=config, celery_task_id=task.id, engine="hermes",
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("hermes.scrape async agent_runs create skipped (%s)", exc)

    return HermesScrapeAsyncResponse(
        run_id=run_id, status="queued", task_id=task.id,
    )


def _enqueue_scrape_task(payload: HermesScrapeRequest):
    """Enqueue ``hermes.scrape_job_board``; return the AsyncResult or None.

    Import is guarded so a missing Celery install or broker does not crash the
    endpoint — the caller falls back to a sync scrape.
    """
    try:
        from app.tasks.scraping import scrape_job_board
    except Exception as exc:  # noqa: BLE001 - celery/broker optional
        logger.warning("hermes.scrape: cannot import scrape_job_board (%s)", exc)
        return None
    try:
        return scrape_job_board.apply_async(
            (payload.query, payload.location, payload.board, payload.limit),
            queue="tayari",
        )
    except Exception as exc:  # noqa: BLE001 - broker down, fall back
        logger.warning("hermes.scrape: apply_async failed (%s)", exc)
        return None


# ---------------------------------------------------------------------------
# 2. GET /jobs/{board}
# ---------------------------------------------------------------------------

@hermes_router.get("/jobs/{board}", response_model=HermesJobsResponse)
async def hermes_jobs_board(board: str, limit: int = Query(40, ge=1, le=500)):
    """Return the most recent cached jobs for a ``board_class``.

    When the cache is unavailable (DATABASE_URL unset / asyncpg missing) the
    response is an empty list so callers can still render the page.
    """
    jobs = await list_by_board(board, limit)
    if jobs is None:
        jobs = []
    return HermesJobsResponse(board=board, count=len(jobs), jobs=jobs)


# ---------------------------------------------------------------------------
# 3. GET /runs
# ---------------------------------------------------------------------------

@hermes_router.get("/runs", response_model=None)
async def hermes_runs_list(
    run_type: Optional[str] = Query(None),
    status: Optional[List[str]] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    user_id: str = Depends(get_current_user),
):
    """List ``agent_runs`` rows, optionally filtered by run_type/status.

    ``status`` accepts repeated values (``?status=running&status=queued``) so
    the Go ``/runs/active`` proxy can fetch both live states in one call.
    Returns ``{"runs": []}`` when the DB is unavailable.
    """
    runs = await _list_agent_runs(user_id, run_type, status, limit)
    if runs is None:
        runs = []
    return {"runs": runs}


async def _list_agent_runs(
    user_id: str,
    run_type: Optional[str],
    status: Optional[List[str]],
    limit: int,
) -> list[dict[str, Any]] | None:
    """Load only runs owned by the authenticated user."""
    return await db_service.list_agent_runs_for_user(
        user_id,
        run_type=run_type,
        statuses=status,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# 4. GET /runs/{run_id}
# ---------------------------------------------------------------------------

@hermes_router.get("/runs/{run_id}", response_model=HermesRunDetailResponse)
async def hermes_run_detail(
    run_id: str,
    user_id: str = Depends(get_current_user),
):
    """Return a single ``agent_runs`` row with parsed logs/screenshots/result.

    404 when the run is not found or the DB is unavailable.
    """
    row = await db_service.load_agent_run_for_user(run_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    return HermesRunDetailResponse(
        run_id=row.get("run_id") or run_id,
        status=row.get("status"),
        progress=row.get("progress"),
        current_step=row.get("current_step"),
        logs=_as_list(row.get("logs")),
        screenshots=_as_list(row.get("screenshots")),
        result=row.get("result") if isinstance(row.get("result"), dict) else None,
        engine=row.get("engine"),
        celery_task_id=row.get("celery_task_id"),
        started_at=_ts(row.get("started_at")),
        completed_at=_ts(row.get("completed_at")),
    )


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row: Any) -> dict[str, Any]:
    """Convert an asyncpg Record to a plain dict (jsonb already parsed by load)."""
    out = dict(row)
    # list/detail path: fetch() returns raw Records; jsonb columns come back as
    # text from asyncpg, so json-parse the structured ones.
    import json as _json
    for k in ("config", "logs", "screenshots", "result"):
        v = out.get(k)
        if isinstance(v, str):
            try:
                out[k] = _json.loads(v)
            except (ValueError, TypeError):
                pass
    return out


def _as_list(value: Any) -> list[dict[str, Any]]:
    """Coerce a jsonb value into a list[dict]; tolerate None/str/other."""
    if value is None:
        return []
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, str):
        import json as _json
        try:
            parsed = _json.loads(value)
            return _as_list(parsed)
        except (ValueError, TypeError):
            return []
    return []


def _ts(value: Any) -> Optional[str]:
    """Serialize a datetime/str timestamp to ISO-8601, or None."""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return value.isoformat()
    except AttributeError:
        return None