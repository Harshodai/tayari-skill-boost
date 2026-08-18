import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_trending_skills_requires_explicit_development_fixture(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_DEMO_FIXTURES", "true")
    response = client.get('/api/v1/career-intelligence/trending-skills')
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        assert data[0]['evidence_class'] == 'demo_fixture'
        assert data[0]['runtime_mode'] == 'development_demo'


def test_trending_skills_is_unavailable_without_live_provider(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("ENABLE_DEMO_FIXTURES", raising=False)
    response = client.get('/api/v1/career-intelligence/trending-skills')
    assert response.status_code == 503
    assert response.json()['detail']['code'] == 'provider_not_configured'

def test_resume_graph_not_found(monkeypatch):
    # Ensure store empty
    from app.services.automation_engine import _autopilot_store
    _autopilot_store.clear()
    response = client.get('/api/v1/resume-graph/unknown-run')
    assert response.status_code == 404
    assert "not found" in response.json()['detail'].lower()
