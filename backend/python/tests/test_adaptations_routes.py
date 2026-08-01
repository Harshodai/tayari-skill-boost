"""Integration tests for Master Adaptations API Gateway routes."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_profile_expand_endpoint():
    res = client.post("/api/v1/adaptations/profile-expand", json={"github_username": ""})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "error"


def test_followup_check_endpoint():
    apps = [{"company": "Acme", "role": "Dev", "status": "submitted", "last_updated_at": "2026-01-01T00:00:00Z"}]
    res = client.post("/api/v1/adaptations/followup-check", json={"applications": apps})
    assert res.status_code == 200
    data = res.json()
    assert data["stale_applications_count"] == 1


def test_codegraph_index_endpoint():
    code = "def greet(name):\n    return f'Hello {name}'\n"
    res = client.post("/api/v1/adaptations/codegraph-index", json={"filename": "test.py", "code_content": code, "target_symbol": "greet"})
    assert res.status_code == 200
    data = res.json()
    assert data["index_result"]["status"] == "success"


def test_truth_subspace_endpoint():
    res = client.post("/api/v1/adaptations/truth-subspace", json={"candidate_text": "Python Go Dev", "jd_text": "Python Engineer", "vocabulary": ["python", "go"]})
    assert res.status_code == 200
    data = res.json()
    assert "alignment_score" in data


def test_graph_visualizer_endpoint():
    res = client.get("/api/v1/adaptations/graph-visualizer")
    assert res.status_code == 200
    data = res.json()
    assert data["total_nodes"] > 0


def test_negotiation_script_endpoint():
    res = client.post("/api/v1/adaptations/negotiation-script", json={"company": "Acme", "role": "Senior Dev", "offered_salary": 140000, "target_salary": 160000})
    assert res.status_code == 200
    data = res.json()
    assert "email_script" in data["negotiation_script"]


def test_squad_run_endpoint():
    res = client.post("/api/v1/adaptations/squad-run", json={"resume_text": "CV", "jd_text": "JD", "company": "Acme", "role": "Dev"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "pending"
    assert data["agents_executed"] == []
