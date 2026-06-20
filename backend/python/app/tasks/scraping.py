"""Celery tasks: Hermes job-board scraping.

``hermes.scrape_job_board`` runs :class:`HermesScraper` under ``asyncio.run``
and returns ``{run_id, count, job_ids}``. The orchestrator already writes the
batch to the ``scraped_jobs`` cache via :mod:`app.services.hermes.cache`, so
this task only orchestrates and records an ``agent_runs`` row (best-effort,
DB-guarded). Everything degrades to a no-op when ``DATABASE_URL`` is unset.
"""
from __future__ import annotations

import asyncio
import logging
import uuid

from app.celery_app import celery_app
from app.services.hermes import HermesScraper

logger = logging.getLogger(__name__)


def _run_scrape(query: str, location: str, board: dict | None, limit: int) -> list[dict]:
    """Run the async scraper in a fresh event loop."""

    async def _scrape() -> list[dict]:
        scraper = HermesScraper()
        return await scraper.scrape(query, location, board, limit)

    return asyncio.run(_scrape())


@celery_app.task(name="hermes.scrape_job_board", bind=True)
def scrape_job_board(self, query: str, location: str = "", board: dict | None = None,
                     limit: int = 40, user_id: str | None = None) -> dict:
    """Scrape a job board via Hermes and cache the results.

    Args:
        query: job search query (e.g. "software engineer").
        location: optional location filter.
        board: optional ``{"class": ..., "token": ...}`` hint targeting an
            ATS board (Greenhouse/Lever/Ashby/Workday).
        limit: max jobs to return.
        user_id: optional user id; when provided an ``agent_runs`` row is
            recorded (DB-guarded no-op otherwise).

    Returns:
        ``{"run_id": str, "count": int, "job_ids": list[str]}``.
    """
    run_id = str(uuid.uuid4())
    _record_scrape_run(run_id, user_id, query, location, board, self.request.id)
    jobs = _run_scrape(query, location, board, limit)
    job_ids = [j.get("id") or j.get("url") or f"{j.get('title')}@{j.get('company')}"
              for j in jobs]
    logger.info("hermes.scrape_job_board: %d jobs for %r/%r", len(jobs), query, location)
    return {"run_id": run_id, "count": len(jobs), "job_ids": job_ids}


def _record_scrape_run(run_id: str, user_id: str | None, query: str, location: str,
                       board: dict | None, celery_task_id: str | None) -> None:
    """Best-effort: create an agent_runs row (run_type='scrape'). DB-guarded."""
    from app.services.db import create_agent_run, update_agent_run, append_log

    config = {"query": query, "location": location, "board": board}

    async def _persist() -> None:
        await create_agent_run(
            run_id=run_id, user_id=user_id, run_type="scrape",
            config=config, celery_task_id=celery_task_id, engine="hermes",
        )
        await append_log(run_id, "SCRAPE", f"Scraping {query!r} / {location!r}")
        await update_agent_run(run_id, status="completed", progress=100)

    try:
        asyncio.run(_persist())
    except Exception as exc:  # noqa: BLE001 - persistence must not fail the task
        logger.debug("scrape agent_runs persist skipped (%s)", exc)