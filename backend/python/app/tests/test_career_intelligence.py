import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_trending_skills():
    response = client.get('/api/v1/career-intelligence/trending-skills')
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Expect each item to have at least a name field
    if data:
        assert 'name' in data[0]

def test_resume_graph_not_found(monkeypatch):
    # Ensure store empty
    from app.services.automation_engine import _autopilot_store
    _autopilot_store.clear()
    response = client.get('/api/v1/resume-graph/unknown-run')
    assert response.status_code == 404
    assert response.json()['detail'] == 'Run not found'
