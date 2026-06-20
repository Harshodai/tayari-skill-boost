"""Celery task tests for the Hermes automation layer (WS-C).

Uses ``celery_app.conf.task_always_eager = True`` so tasks run synchronously
in-process (no broker needed). ``DATABASE_URL`` is monkeypatched to ``""`` so
every DB op is a guarded no-op, and ``HermesScraper.scrape`` /
``automation_engine.run_autopilot`` are stubbed so no network or LLM calls
fire.

Run:  python -m pytest tests/test_celery_tasks.py -v
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.celery_app import celery_app
from app.services import automation_engine as ae
from app.tasks import automation as automation_task
from app.tasks import scraping as scraping_task


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def eager_celery():
    """Run Celery tasks synchronously in-process for the duration of a test."""
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = False
    celery_app.conf.task_eager_propagates = False


@pytest.fixture(autouse=True)
def no_db(monkeypatch):
    """Force every DB helper to be a no-op (DATABASE_URL unset)."""
    monkeypatch.setenv("DATABASE_URL", "")
    # Reset the cached pool flag so the empty URL is re-read.
    import app.services.db as db_mod
    db_mod._pool = None
    db_mod._pool_checked = False
    # hermes.config caches DATABASE_URL at import; patch the attribute too.
    monkeypatch.setattr("app.services.hermes.config.DATABASE_URL", "", raising=False)


# ---------------------------------------------------------------------------
# scrape_job_board
# ---------------------------------------------------------------------------

def test_scrape_job_board_returns_expected_shape():
    """scrape_job_board runs the scraper (stubbed) and returns {run_id,count,job_ids}."""
    fake_jobs = [
        {"id": "j1", "title": "Backend Engineer", "company": "Acme",
         "url": "https://acme.com/j1", "description": "x" * 250},
        {"id": "j2", "title": "Senior Backend", "company": "Globex",
         "url": "https://globex.com/j2", "description": "y" * 250},
    ]
    with patch.object(
        scraping_task.HermesScraper, "scrape",
        new=AsyncMock(return_value=fake_jobs),
    ):
        result = scraping_task.scrape_job_board.apply(
            kwargs={"query": "backend engineer", "location": "remote",
                    "board": {"class": "greenhouse", "token": "airbnb"},
                    "limit": 10, "user_id": None},
        ).get()

    assert isinstance(result, dict)
    assert set(result.keys()) == {"run_id", "count", "job_ids"}
    assert result["count"] == 2
    assert result["run_id"]  # non-empty string
    assert result["job_ids"] == ["j1", "j2"]


def test_scrape_job_board_empty_results():
    """An empty scrape batch still returns the expected shape."""
    with patch.object(
        scraping_task.HermesScraper, "scrape",
        new=AsyncMock(return_value=[]),
    ):
        result = scraping_task.scrape_job_board.apply(
            kwargs={"query": "nonsense role", "location": "", "board": None,
                    "limit": 5},
        ).get()
    assert result["count"] == 0
    assert result["job_ids"] == []


def test_scrape_job_board_id_fallback_when_no_id():
    """job_ids fall back to url then title@company when id is missing."""
    fake = [{"title": "Dev", "company": "Acme", "url": "https://acme.com/1",
             "description": "z" * 250}]
    with patch.object(
        scraping_task.HermesScraper, "scrape",
        new=AsyncMock(return_value=fake),
    ):
        result = scraping_task.scrape_job_board.apply(
            kwargs={"query": "dev", "location": "", "board": None, "limit": 5},
        ).get()
    assert result["job_ids"] == ["https://acme.com/1"]


# ---------------------------------------------------------------------------
# run_application_agent
# ---------------------------------------------------------------------------

def test_run_application_agent_calls_run_autopilot():
    """run_application_agent wraps run_autopilot and returns {run_id,status}."""
    fake_state = {"status": "completed", "progress": 100,
                  "current_step": "DONE", "applications": []}
    run_mock = AsyncMock(return_value=None)
    with patch.object(ae, "run_autopilot", new=run_mock), \
         patch.object(ae, "get_run_status", return_value=fake_state):
        result = automation_task.run_application_agent.apply(
            args=("run-123", {"user_id": "u1"}, None, "resume text", "Alice"),
        ).get()
        run_mock.assert_awaited_once()

    assert result == {"run_id": "run-123", "status": "completed"}


def test_run_application_agent_reports_failure_on_exception():
    """A raised run_autopilot surfaces as status=failed, not a propagated error."""
    with patch.object(
        ae, "run_autopilot",
        new=AsyncMock(side_effect=RuntimeError("boom")),
    ):
        result = automation_task.run_application_agent.apply(
            args=("run-err", {"user_id": "u1"}, None, "", "Bob"),
        ).get()
    assert result == {"run_id": "run-err", "status": "failed"}


# ---------------------------------------------------------------------------
# run_scheduled
# ---------------------------------------------------------------------------

def test_run_scheduled_enqueues_application_agent():
    """run_scheduled loads user context (DB-guarded -> empty) and enqueues."""
    # Eager mode: apply_async runs the task inline. Patch the target task so
    # we can assert it would be enqueued, and patch the DB loader to empty.
    captured = {}

    def fake_apply(args=None, kwargs=None, queue=None, **_):
        captured["args"] = args
        captured["queue"] = queue

        class _R:
            id = "fake-task-id"
        return _R()

    with patch.object(
        automation_task, "_load_user_context",
        return_value=(None, "", "Candidate"),
    ), patch.object(
        automation_task.run_application_agent, "apply_async",
        side_effect=fake_apply,
    ):
        result = automation_task.run_scheduled.apply(
            args=("user-abc", {"job_titles": ["engineer"]}),
        ).get()

    assert result["task_id"] == "fake-task-id"
    assert result["run_id"]  # generated
    assert captured["queue"] == "tayari"
    # The enqueued run_id is the first positional arg.
    assert captured["args"][0] == result["run_id"]
    # user_id is injected into the config before enqueue.
    enqueued_config = captured["args"][1]
    assert enqueued_config["user_id"] == "user-abc"


# ---------------------------------------------------------------------------
# automation_engine DB-guarded persistence
# ---------------------------------------------------------------------------

def test_get_run_status_falls_back_to_in_memory_when_db_off(monkeypatch):
    """With DATABASE_URL unset, get_run_status reads only the in-memory cache."""
    import app.services.automation_engine as ae
    ae._autopilot_store["run-x"] = {"run_id": "run-x", "status": "running"}
    assert ae.get_run_status("run-x")["status"] == "running"
    # Unknown run with DB off -> None (no blocking DB read succeeds).
    assert ae.get_run_status("does-not-exist") is None
    ae._autopilot_store.pop("run-x", None)


def test_update_run_does_not_raise_without_db(monkeypatch):
    """_update_run/_log stay safe (no DB, no running loop)."""
    import app.services.automation_engine as ae
    ae._autopilot_store["run-y"] = {"run_id": "run-y", "logs": []}
    ae._update_run("run-y", status="running", progress=10)
    ae._log("run-y", "SEARCH", "looking")
    assert ae._autopilot_store["run-y"]["status"] == "running"
    assert ae._autopilot_store["run-y"]["logs"][0]["step"] == "SEARCH"
    ae._autopilot_store.pop("run-y", None)