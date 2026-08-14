import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.operation_budget import BudgetRule, OperationBudget, OperationBudgetMiddleware


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
