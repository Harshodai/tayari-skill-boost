"""Tests for the Hermes HTTP endpoints (WS-E).

DB is monkeypatched to be unavailable (``get_pool`` returns None) and the
Celery ``apply_async`` + ``HermesScraper.scrape`` are stubbed so no network,
broker, or LLM calls fire. Uses httpx's ASGI transport to drive the app
without starting a real server. Tests are sync functions that wrap async
flows in ``asyncio.run`` to match the repo's pytest-asyncio-strict pattern
(see test_hermes_providers.py).
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import httpx
import pytest

pytest.importorskip("fastapi")

from app.api.hermes_routes import hermes_router, _as_list
from app.services.hermes import HermesScraper
from app.services import db as db_service


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def no_db(monkeypatch):
    """Force the central DB pool to be unavailable (None) for every test."""
    monkeypatch.setattr(db_service, "get_pool", AsyncMock(return_value=None))
    db_service._pool = None
    db_service._pool_checked = False
    import app.services.hermes.cache as cache_mod
    cache_mod._pool = None
    cache_mod._pool_checked = False
    monkeypatch.setattr("app.services.hermes.config.DATABASE_URL", "", raising=False)


def _make_client(user_id: str = "user-a") -> httpx.AsyncClient:
    """Build an authenticated Hermes-only ASGI client without app.main lifespan."""
    from fastapi import FastAPI
    from app.auth.dependencies import get_current_user

    app = FastAPI()
    app.include_router(hermes_router)
    app.dependency_overrides[get_current_user] = lambda: user_id
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=True)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


# ---------------------------------------------------------------------------
# POST /scrape
# ---------------------------------------------------------------------------

def test_scrape_sync_returns_jobs():
    """sync=True runs the scraper inline and returns count + jobs."""
    fake_jobs = [
        {"id": "j1", "title": "Backend", "company": "Acme",
         "url": "https://acme.com/j1", "description": "x" * 250},
    ]

    async def run():
        with patch.object(
            HermesScraper, "scrape", new=AsyncMock(return_value=fake_jobs),
        ):
            async with _make_client() as client:
                resp = await client.post("/api/v1/hermes/scrape", json={
                    "query": "backend", "location": "remote",
                    "sync": True, "limit": 5,
                })
        return resp

    resp = asyncio.run(run())
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["count"] == 1
    assert body["jobs"] == fake_jobs
    assert body["run_id"]


def test_scrape_async_returns_queued():
    """sync=False enqueues a Celery task and returns status=queued + task_id."""
    fake_task = type("_T", (), {"id": "celery-task-123"})()

    async def run():
        with patch(
            "app.api.hermes_routes._enqueue_scrape_task",
            return_value=fake_task,
        ) as enqueue_mock:
            async with _make_client() as client:
                resp = await client.post("/api/v1/hermes/scrape", json={
                    "query": "engineer", "location": "", "sync": False,
                })
        return resp, enqueue_mock

    resp, enqueue_mock = asyncio.run(run())
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "queued"
    assert body["task_id"] == "celery-task-123"
    assert body["run_id"]
    enqueue_mock.assert_called_once()


def test_scrape_async_falls_back_to_sync_when_celery_unavailable():
    """When Celery cannot be imported/enqueued, the endpoint falls back to a
    sync scrape (still returns 200)."""
    fake_jobs = [{"id": "j1", "title": "Dev", "company": "X",
                 "url": "https://x.com/1", "description": "z" * 250}]

    async def run():
        with patch(
            "app.api.hermes_routes._enqueue_scrape_task", return_value=None,
        ), patch.object(
            HermesScraper, "scrape", new=AsyncMock(return_value=fake_jobs),
        ):
            async with _make_client() as client:
                resp = await client.post("/api/v1/hermes/scrape", json={
                    "query": "dev", "sync": False,
                })
        return resp

    resp = asyncio.run(run())
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["count"] == 1


# ---------------------------------------------------------------------------
# GET /jobs/{board}
# ---------------------------------------------------------------------------

def test_jobs_board_returns_empty_when_cache_none():
    """With the cache unavailable (pool None) the endpoint returns count=0."""

    async def run():
        async with _make_client() as client:
            return await client.get("/api/v1/hermes/jobs/greenhouse?limit=10")

    resp = asyncio.run(run())
    assert resp.status_code == 200
    body = resp.json()
    assert body["board"] == "greenhouse"
    assert body["count"] == 0
    assert body["jobs"] == []


def test_jobs_board_returns_cached_jobs(monkeypatch):
    """When list_by_board returns jobs, the endpoint surfaces them."""
    cached = [{"id": "c1", "title": "Senior Dev", "company": "Globex"}]
    monkeypatch.setattr(
        "app.api.hermes_routes.list_by_board",
        AsyncMock(return_value=cached),
    )

    async def run():
        async with _make_client() as client:
            return await client.get("/api/v1/hermes/jobs/greenhouse")

    resp = asyncio.run(run())
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    assert body["jobs"] == cached


# ---------------------------------------------------------------------------
# GET /runs
# ---------------------------------------------------------------------------

def test_runs_list_returns_empty_when_db_off():
    """With no DB pool, the runs list returns {runs: []}."""

    async def run():
        async with _make_client() as client:
            return await client.get("/api/v1/hermes/runs")

    resp = asyncio.run(run())
    assert resp.status_code == 200
    assert resp.json() == {"runs": []}


def test_runs_list_filters_pass_through(monkeypatch):
    """Query params run_type/status/limit are forwarded to _list_agent_runs."""
    captured: dict = {}
    fake_rows = [{"run_id": "r1", "run_type": "scrape", "status": "completed"}]

    async def fake_list(user_id, run_type, status, limit):
        captured["user_id"] = user_id
        captured["run_type"] = run_type
        captured["status"] = status
        captured["limit"] = limit
        return fake_rows

    monkeypatch.setattr("app.api.hermes_routes._list_agent_runs", fake_list)

    async def run():
        async with _make_client() as client:
            return await client.get(
                "/api/v1/hermes/runs?run_type=scrape&status=completed&limit=10",
            )

    resp = asyncio.run(run())
    assert captured["user_id"] == "user-a"
    assert captured["run_type"] == "scrape"
    assert captured["limit"] == 10
    assert captured["status"] == ["completed"]


# ---------------------------------------------------------------------------
# GET /runs/{run_id}
# ---------------------------------------------------------------------------

def test_run_detail_404_when_not_found():
    """Unknown run_id with DB off -> 404."""

    async def run():
        async with _make_client() as client:
            return await client.get("/api/v1/hermes/runs/does-not-exist")

    resp = asyncio.run(run())
    assert resp.status_code == 404


def test_run_detail_200_for_stubbed_row(monkeypatch):
    """When load_agent_run returns a row, the endpoint surfaces the full shape."""
    row = {
        "run_id": "r-abc",
        "status": "running",
        "progress": 42,
        "current_step": "GATHER",
        "logs": [{"step": "GATHER", "message": "collecting",
                  "at": "2026-01-01T00:00:00Z"}],
        "screenshots": [{"step": "APPLY", "url": "https://x/s.png",
                         "captured_at": "2026-01-01T00:01:00Z"}],
        "result": {"count": 3, "jobs": []},
        "engine": "hermes",
        "celery_task_id": "task-9",
        "started_at": "2026-01-01T00:00:00Z",
        "completed_at": None,
    }
    monkeypatch.setattr(
        db_service, "load_agent_run_for_user", AsyncMock(return_value=row),
    )

    async def run():
        async with _make_client() as client:
            return await client.get("/api/v1/hermes/runs/r-abc")

    resp = asyncio.run(run())
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"] == "r-abc"
    assert body["status"] == "running"
    assert body["progress"] == 42
    assert body["logs"][0]["step"] == "GATHER"
    assert body["screenshots"][0]["step"] == "APPLY"
    assert body["result"] == {"count": 3, "jobs": []}
    assert body["engine"] == "hermes"
    assert body["celery_task_id"] == "task-9"
    assert body["started_at"] == "2026-01-01T00:00:00Z"
    assert body["completed_at"] is None


def test_run_detail_is_not_visible_to_another_user(monkeypatch):
    """The same run id must not cross an owner boundary."""
    async def owner_scoped_lookup(run_id, user_id):
        if user_id == "user-a":
            return {"run_id": run_id, "status": "running"}
        return None

    monkeypatch.setattr(db_service, "load_agent_run_for_user", owner_scoped_lookup)

    async def run():
        async with _make_client("user-b") as client:
            return await client.get("/api/v1/hermes/runs/r-abc")

    resp = asyncio.run(run())
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# helper sanity
# ---------------------------------------------------------------------------

def test_as_list_coerces_strings_and_none():
    """_as_list handles None, JSON strings, lists, and junk gracefully."""
    assert _as_list(None) == []
    assert _as_list([]) == []
    assert _as_list([{"a": 1}, "x"]) == [{"a": 1}]
    assert _as_list('[{"a": 1}]') == [{"a": 1}]
    assert _as_list("not-json") == []
    assert _as_list(42) == []