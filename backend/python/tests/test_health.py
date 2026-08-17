"""Health endpoint / active-engine agreement tests.

Guards against the drift where ``MockProvider.active_engine_label()`` changed
from ``"mock-fallback"`` to ``"unconfigured"`` (see llm_service.py) but
``routes/health.py`` still compared against the old string, so
``model_status`` reported "loaded" even with zero LLM providers configured.

Run: python -m pytest tests/test_health.py -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routes import health as health_route
from app.services import llm_service
from app.services.hermes import config as hermes_config

client = TestClient(app)


@pytest.fixture
def unconfigured_env(monkeypatch):
    """No LLM provider, no Hermes tier — the "nothing configured" baseline."""
    monkeypatch.setenv("LLM_PROVIDER", "")
    monkeypatch.setenv("LLM_BASE_URL", "")
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("NVIDIA_NIM_API_KEY", "")
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "")


def test_active_engine_is_unconfigured_with_no_provider(unconfigured_env):
    assert llm_service.active_engine() == "unconfigured"


def test_is_llm_configured_false_with_no_provider(unconfigured_env):
    assert llm_service.is_llm_configured() is False


def test_is_llm_configured_true_with_generic_provider(unconfigured_env, monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    assert llm_service.is_llm_configured() is True
    assert llm_service.active_engine() != "unconfigured"


def test_is_llm_configured_true_with_hermes(unconfigured_env, monkeypatch):
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://hermes:9000")
    monkeypatch.setattr(hermes_config, "HERMES_MODEL", "hermes3:8b")
    assert llm_service.is_llm_configured() is True


def test_health_check_reports_llm_not_configured(unconfigured_env):
    resp = health_route.health_check()
    assert resp.model_status == "llm_not_configured"


def test_health_check_handles_explicit_provider_without_credentials(unconfigured_env, monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    resp = health_route.health_check()
    assert resp.status == "ok"
    assert resp.model_status == "llm_not_configured"


def test_health_check_reports_loaded_when_configured(unconfigured_env, monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    resp = health_route.health_check()
    assert resp.model_status == "loaded"


@pytest.mark.parametrize("path", ["/health", "/api/health", "/api/v1/health", "/healthz"])
def test_health_route_returns_200(path):
    resp = client.get(path)
    assert resp.status_code == 200


def test_readyz_fails_closed_with_missing_explicit_provider(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    response = client.get("/readyz")
    assert response.status_code == 503
    assert response.json()["detail"] == "llm_not_configured"


def test_readyz_fails_closed_without_database(monkeypatch):
    async def no_pool():
        return None

    import app.services.db as db
    monkeypatch.setattr(db, "get_pool", no_pool)
    response = client.get("/readyz")
    assert response.status_code == 503


def test_health_routes_have_identical_bodies():
    bodies = [client.get(p).json() for p in ("/health", "/api/health", "/api/v1/health", "/healthz")]
    assert all(body == bodies[0] for body in bodies[1:])
