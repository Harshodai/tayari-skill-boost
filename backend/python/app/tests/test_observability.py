"""Proof tests for release-critical operational telemetry contracts."""
from __future__ import annotations

import json
import logging
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware.operation_budget import BudgetRule, OperationBudgetMiddleware
from app.services import llm_service
from app.telemetry import metrics
from app.celery_app import (
    _mark_task_enqueued,
    _record_task_failure,
    _record_task_postrun,
    _record_task_prerun,
)


@pytest.fixture(autouse=True)
def reset_metrics(monkeypatch):
    metrics.reset()
    monkeypatch.setenv("ENV", "test")
    monkeypatch.delenv("METRICS_TOKEN", raising=False)
    monkeypatch.delenv("AI_INTERNAL_TOKEN", raising=False)
    yield
    metrics.reset()


@pytest.mark.asyncio
async def test_llm_provider_error_increments_counter(monkeypatch):
    class FailingProvider:
        def active_engine_label(self):
            return "test-provider"

        async def complete(self, *_args, **_kwargs):
            raise llm_service.LLMNotConfiguredError("provider unavailable")

    monkeypatch.setattr(llm_service, "build_provider", lambda _tier: FailingProvider())
    with pytest.raises(llm_service.LLMNotConfiguredError):
        await llm_service.llm_complete("system", "user", tier="fast")

    snapshot = metrics.snapshot()
    assert snapshot["counters"]["llm_errors_total"] == 1
    assert snapshot["provider_errors_by_name"] == {"test-provider": 1}


@pytest.mark.asyncio
async def test_budget_rejection_increments_counter():
    class DenyBudget:
        rules = {"public_ats_scan": BudgetRule(1, 60)}

        async def consume(self, _operation, _identity):
            return False

    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    middleware = OperationBudgetMiddleware(lambda *_args: None, budget=DenyBudget())
    scope = {
        "type": "http",
        "path": "/api/v1/ats/score",
        "method": "POST",
        "headers": [],
        "client": ("127.0.0.1", 1234),
    }
    await middleware(scope, receive, send)

    assert sent[0]["type"] == "http.response.start"
    assert sent[0]["status"] == 429
    assert metrics.snapshot()["counters"]["budget_exceeded_total"] == 1


def test_metrics_route_is_token_protected_and_reports_alert_counters(monkeypatch):
    monkeypatch.setenv("METRICS_TOKEN", "metrics-test-token")
    metrics.increment("budget_exceeded_total", 2)
    metrics.record_provider_error("test-provider")
    metrics.record_queue_age(321.5)

    client = TestClient(app)
    assert client.get("/metrics").status_code == 401
    response = client.get("/metrics", headers={"X-Internal-Token": "metrics-test-token"})
    assert response.status_code == 200
    body = response.json()
    assert body["counters"]["llm_errors_total"] == 1
    assert body["counters"]["budget_exceeded_total"] == 2
    assert body["queue_age_seconds"] == 321.5


def test_structured_request_log_contains_correlation_contract(caplog):
    client = TestClient(app)
    with caplog.at_level(logging.INFO, logger="tayari.http"):
        response = client.get("/healthz", headers={"X-Request-ID": "proof-trace-id"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "proof-trace-id"
    events = []
    for record in caplog.records:
        try:
            payload = json.loads(record.getMessage())
        except json.JSONDecodeError:
            continue
        if payload.get("event") == "http_request":
            events.append(payload)
    assert events, "structured http_request event was not emitted"
    event = events[-1]
    assert event["trace_id"] == "proof-trace-id"
    assert event["method"] == "GET"
    assert event["path"] == "/healthz"
    assert event["status"] == 200
    assert isinstance(event["duration_ms"], (float, int))


def test_celery_signals_record_queue_age_and_task_outcomes():
    metrics.reset()
    headers = {}
    _mark_task_enqueued(headers=headers)
    assert "tayari_enqueued_at" in headers

    task = SimpleNamespace(
        name="proof.task",
        request=SimpleNamespace(headers={"tayari_enqueued_at": str(time.time() - 12)}),
    )
    _record_task_prerun(task_id="ok-task", task=task)
    assert metrics.snapshot()["queue_age_seconds"] >= 10
    _record_task_postrun(task_id="ok-task", task=task, state="SUCCESS")
    assert metrics.snapshot()["counters"]["tasks_completed_total"] == 1

    _record_task_prerun(task_id="failed-task", task=task)
    _record_task_failure(
        task_id="failed-task",
        task=task,
        exception=RuntimeError("proof failure"),
    )
    assert metrics.snapshot()["counters"]["task_failures_total"] == 1
