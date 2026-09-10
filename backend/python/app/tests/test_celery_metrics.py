"""Test Celery concurrency settings and Prometheus metrics endpoints."""
import os
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.celery_app import (
    celery_app,
    get_celery_queue_depth,
    format_prometheus_metrics,
    export_celery_queue_metrics,
)


def test_celery_worker_configuration():
    assert celery_app.conf.worker_concurrency <= 4
    assert celery_app.conf.worker_concurrency >= 1
    assert celery_app.conf.worker_max_memory_per_child == 512_000


def test_get_celery_queue_depth_success():
    with patch("redis.Redis.from_url") as mock_from_url:
        mock_client = MagicMock()
        mock_client.llen.return_value = 5
        mock_from_url.return_value = mock_client

        depth = get_celery_queue_depth("tayari")
        assert depth == 5
        mock_client.llen.assert_called_once_with("tayari")


def test_get_celery_queue_depth_handles_redis_error():
    with patch("redis.Redis.from_url", side_effect=Exception("Redis connection error")):
        depth = get_celery_queue_depth("tayari")
        assert depth == 0


def test_format_prometheus_metrics():
    with patch("app.celery_app.get_celery_queue_depth", return_value=12):
        metrics_output = format_prometheus_metrics()
        assert "# HELP celery_queue_depth Number of tasks in Celery queue" in metrics_output
        assert "# TYPE celery_queue_depth gauge" in metrics_output
        assert 'celery_queue_depth{queue="tayari"} 12' in metrics_output


def test_prometheus_metrics_endpoint():
    from app.main import app
    client = TestClient(app, raise_server_exceptions=False)

    with patch("app.celery_app.get_celery_queue_depth", return_value=7):
        # Test /metrics/prometheus
        resp1 = client.get("/metrics/prometheus")
        assert resp1.status_code == 200
        assert resp1.headers["content-type"].startswith("text/plain")
        assert 'celery_queue_depth{queue="tayari"} 7' in resp1.text

        # Test /api/v1/metrics/prometheus
        resp2 = client.get("/api/v1/metrics/prometheus")
        assert resp2.status_code == 200
        assert resp2.headers["content-type"].startswith("text/plain")
        assert 'celery_queue_depth{queue="tayari"} 7' in resp2.text
