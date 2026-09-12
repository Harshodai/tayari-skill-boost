import asyncio

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.middleware.operation_budget import BudgetRule, OperationBudget, OperationBudgetMiddleware, OperationBudgetUnavailable


class FakeRedisPipeline:
    def __init__(self):
        self.counts = {}
        self.key = None

    def incr(self, key):
        self.key = key
        self.counts[key] = self.counts.get(key, 0) + 1
        return self

    def expire(self, _key, _seconds):
        return self

    async def execute(self):
        return [self.counts[self.key], True]


class FakeRedis:
    def __init__(self):
        self.pipeline_instance = FakeRedisPipeline()

    def pipeline(self, transaction=True):
        assert transaction is True
        return self.pipeline_instance


@pytest.mark.asyncio
async def test_production_operation_budget_fails_closed_without_redis():
    budget = OperationBudget({"ai": BudgetRule(limit=1, window_seconds=60)}, fail_closed=True)
    with pytest.raises(OperationBudgetUnavailable, match="Redis quota backend unavailable"):
        await budget.consume("ai", "user:a", now=100.0)


@pytest.mark.asyncio
async def test_operation_budget_rejects_after_limit_and_allows_after_window():
    budget = OperationBudget({"browser": BudgetRule(limit=2, window_seconds=10)})

    assert await budget.consume("browser", "user:a", now=100.0) is True
    assert await budget.consume("browser", "user:a", now=101.0) is True
    assert await budget.consume("browser", "user:a", now=102.0) is False
    assert await budget.consume("browser", "user:a", now=111.0) is True


@pytest.mark.asyncio
async def test_operation_budget_separates_tenants():
    budget = OperationBudget({"ai": BudgetRule(limit=1, window_seconds=60)})

    assert await budget.consume("ai", "user:a", now=100.0) is True
    assert await budget.consume("ai", "user:a", now=101.0) is False
    assert await budget.consume("ai", "user:b", now=101.0) is True



@pytest.mark.asyncio
async def test_operation_budget_uses_shared_redis_counter():
    redis = FakeRedis()
    budget = OperationBudget(
        {"ai": BudgetRule(limit=2, window_seconds=60)},
        redis_client=redis,
        fail_closed=True,
    )

    assert await budget.consume("ai", "user:a", now=120.0) is True
    assert await budget.consume("ai", "user:a", now=121.0) is True
    assert await budget.consume("ai", "user:a", now=122.0) is False


def test_shared_redis_budget_holds_across_two_service_instances():
    redis = FakeRedis()
    rules = {"public": BudgetRule(limit=2, window_seconds=60)}
    replica_a = OperationBudget(rules, redis_client=redis, fail_closed=True)
    replica_b = OperationBudget(rules, redis_client=redis, fail_closed=True)

    async def exercise():
        assert await replica_a.consume("public", "anon:ip:198.51.100.2", now=120.0) is True
        assert await replica_b.consume("public", "anon:ip:198.51.100.2", now=121.0) is True
        return await replica_a.consume("public", "anon:ip:198.51.100.2", now=122.0)

    assert asyncio.run(exercise()) is False


def test_public_flood_is_rejected_before_expensive_handler():
    app = FastAPI()
    calls = {"count": 0}

    @app.post("/api/v1/ats/score")
    async def public_scan():
        calls["count"] += 1
        return {"score": 100}

    budget = OperationBudget({"public_ats_scan": BudgetRule(limit=2, window_seconds=60)})
    app.add_middleware(OperationBudgetMiddleware, budget=budget)
    client = TestClient(app)

    assert client.post("/api/v1/ats/score").status_code == 200
    assert client.post("/api/v1/ats/score").status_code == 200
    blocked = client.post("/api/v1/ats/score")
    assert blocked.status_code == 429
    assert calls["count"] == 2



@pytest.mark.asyncio
async def test_autopilot_run_dispatches_to_celery_without_blocking(monkeypatch):
    """/api/v1/autopilot/run must enqueue via Celery and return immediately,
    never run the pipeline in-process.

    ponytail: this used to test an in-process asyncio.create_task +
    semaphore backpressure mechanism (_AUTOPILOT_QUEUE_CAPACITY/
    _autopilot_active). That mechanism was removed: the endpoint now
    dispatches to the existing autopilot.run_application_agent Celery task
    (app/tasks/automation.py) instead of running run_autopilot on the
    request-serving event loop — see the docstring on autopilot_run for why
    (heavy pipeline work sharing the API's own loop, and every deploy
    silently killing in-flight runs). Celery's own broker/worker
    concurrency is the real backpressure now, not a local semaphore.
    """
    import app.main as main_module
    import app.tasks.automation as automation_tasks

    calls = []

    class FakeDelay:
        def delay(self, *args):
            calls.append(args)

    monkeypatch.setattr(automation_tasks, "run_application_agent", FakeDelay())

    payload = main_module.AutopilotRunRequest(
        run_config={"job_titles": ["Engineer"]},
        profile={"name": "Test"},
        resume_text="resume text",
        candidate_name="Test User",
    )

    result = await main_module.autopilot_run(payload, _user_id="user-a")

    assert result["status"] == "queued"
    assert "run_id" in result
    assert calls, "expected run_application_agent.delay to be called"
    run_id, run_config, profile, resume_text, candidate_name = calls[0]
    assert run_id == result["run_id"]
    assert run_config["user_id"] == "user-a"
    assert run_config["job_titles"] == ["Engineer"]
    assert profile == {"name": "Test"}
    assert resume_text == "resume text"
    assert candidate_name == "Test User"


def test_operation_middleware_returns_429_before_handler():
    app = FastAPI()
    calls = {"count": 0}

    @app.post("/api/v1/autopilot/run")
    async def run():
        calls["count"] += 1
        return {"ok": True}

    budget = OperationBudget({"autopilot_start": BudgetRule(limit=1, window_seconds=60)})
    app.add_middleware(OperationBudgetMiddleware, budget=budget)
    client = TestClient(app)
    headers = {"X-User-Id": "user-a"}

    assert client.post("/api/v1/autopilot/run", headers=headers).status_code == 200
    blocked = client.post("/api/v1/autopilot/run", headers=headers)
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"] == "60"
    assert calls["count"] == 1
