import asyncio

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.middleware.operation_budget import BudgetRule, OperationBudget, OperationBudgetMiddleware


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
async def test_autopilot_queue_backpressure_rejects_when_capacity_is_full(monkeypatch):
    import app.main as main_module

    async def blocked_run(*_args):
        await asyncio.sleep(60)

    monkeypatch.setattr(main_module.automation_engine, "run_autopilot", blocked_run)
    monkeypatch.setattr(main_module, "_AUTOPILOT_QUEUE_CAPACITY", 1)
    monkeypatch.setattr(main_module, "_autopilot_active", 0)
    payload = main_module.AutopilotRunRequest(run_config={})

    await main_module.autopilot_run(payload, _user_id="user-a")
    await asyncio.sleep(0)
    with pytest.raises(HTTPException) as exc:
        await main_module.autopilot_run(payload, _user_id="user-a")
    assert exc.value.status_code == 429

    current = asyncio.current_task()
    pending = [task for task in asyncio.all_tasks() if task is not current and not task.done()]
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)


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
