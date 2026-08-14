"""Integration tests for Master Adaptations API Gateway routes."""

import pytest
from fastapi.testclient import TestClient
import httpx
from app.main import app
from app.services.profile_expander import ProfileExpander
from app.services.codegraph_service import CodeGraphEngine

client = TestClient(app)


class FakeResponse:
    def __init__(self, status_code: int, payload=None, invalid_json: bool = False):
        self.status_code = status_code
        self._payload = payload
        self._invalid_json = invalid_json

    def json(self):
        if self._invalid_json:
            raise ValueError("malformed JSON")
        return self._payload


class FakeAsyncClient:
    def __init__(self, response=None, exc=None, **kwargs):
        self._response = response
        self._exc = exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def get(self, url, headers=None):
        if self._exc is not None:
            raise self._exc
        return self._response


def _patch_http_client(monkeypatch, response=None, exc=None):
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kwargs: FakeAsyncClient(response=response, exc=exc)
    )


def test_profile_expand_endpoint():
    res = client.post("/api/v1/adaptations/profile-expand", json={"github_username": ""})
    assert res.status_code == 400
    assert res.json()["detail"] == "github_username is required"


def test_profile_expand_translates_service_failure(monkeypatch):
    async def fake_expand(username):
        return {"status": "error", "message": "GitHub API fetch failed"}

    monkeypatch.setattr(ProfileExpander, "expand_from_github", fake_expand)
    res = client.post("/api/v1/adaptations/profile-expand", json={"github_username": "octocat"})
    assert res.status_code == 502
    assert res.json()["detail"] == "GitHub API fetch failed"


@pytest.mark.asyncio
async def test_expand_from_github_reports_error_on_non_200(monkeypatch):
    _patch_http_client(monkeypatch, response=FakeResponse(status_code=404, payload={"message": "Not Found"}))
    result = await ProfileExpander.expand_from_github("octocat")
    assert result["status"] == "error"
    assert "404" in result["message"]


@pytest.mark.asyncio
async def test_expand_from_github_reports_error_on_transport_failure(monkeypatch):
    _patch_http_client(monkeypatch, exc=httpx.ConnectError("connection refused"))
    result = await ProfileExpander.expand_from_github("octocat")
    assert result["status"] == "error"
    assert "Failed to expand GitHub profile" in result["message"]


@pytest.mark.asyncio
async def test_expand_from_github_reports_error_on_malformed_json(monkeypatch):
    _patch_http_client(monkeypatch, response=FakeResponse(status_code=200, invalid_json=True))
    result = await ProfileExpander.expand_from_github("octocat")
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_expand_from_github_succeeds_with_empty_skills_on_empty_repo_list(monkeypatch):
    _patch_http_client(monkeypatch, response=FakeResponse(status_code=200, payload=[]))
    result = await ProfileExpander.expand_from_github("octocat")
    assert result["status"] == "success"
    assert result["discovered_skills"] == []
    assert result["total_repos_analyzed"] == 0


def test_profile_expand_reaches_502_with_real_service_on_fetch_failure(monkeypatch):
    _patch_http_client(monkeypatch, response=FakeResponse(status_code=404, payload={"message": "Not Found"}))
    res = client.post("/api/v1/adaptations/profile-expand", json={"github_username": "octocat"})
    assert res.status_code == 502
    assert "404" in res.json()["detail"]


def test_followup_check_endpoint():
    apps = [{"company": "Acme", "role": "Dev", "status": "submitted", "last_updated_at": "2026-01-01T00:00:00Z"}]
    res = client.post("/api/v1/adaptations/followup-check", json={"applications": apps})
    assert res.status_code == 200
    data = res.json()
    assert data["stale_applications_count"] == 1
    assert "Candidate" in data["drafts"][0]["subject"]


def test_followup_check_endpoint_uses_provided_candidate_name():
    apps = [{"company": "Acme", "role": "Dev", "status": "submitted", "last_updated_at": "2026-01-01T00:00:00Z"}]
    res = client.post("/api/v1/adaptations/followup-check", json={"applications": apps, "candidate_name": "Harshodai"})
    assert res.status_code == 200
    assert "Harshodai" in res.json()["drafts"][0]["subject"]


def test_codegraph_index_endpoint():
    code = "def greet(name):\n    return f'Hello {name}'\n"
    res = client.post("/api/v1/adaptations/codegraph-index", json={"filename": "test.py", "code_content": code, "target_symbol": "greet"})
    assert res.status_code == 200
    data = res.json()
    assert data["index_result"]["status"] == "success"


def test_codegraph_index_rejects_invalid_source(monkeypatch):
    def fake_index(self, filename, code_content):
        raise ValueError("unparseable source")

    monkeypatch.setattr(CodeGraphEngine, "index_source_code", fake_index)
    res = client.post("/api/v1/adaptations/codegraph-index", json={"filename": "x.py", "code_content": "def x(:"})
    assert res.status_code == 400
    assert "unparseable source" in res.json()["detail"]


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


def test_graph_visualizer_uses_generic_sample_name():
    res = client.get("/api/v1/adaptations/graph-visualizer")
    assert res.status_code == 200
    body = res.text
    assert "Harshodai" not in body
    assert "Sample Candidate" in body


def test_negotiation_script_endpoint():
    res = client.post("/api/v1/adaptations/negotiation-script", json={"company": "Acme", "role": "Senior Dev", "offered_salary": 140000, "target_salary": 160000})
    assert res.status_code == 200
    data = res.json()
    assert "email_script" in data["negotiation_script"]


def test_squad_run_endpoint():
    res = client.post("/api/v1/adaptations/squad-run", json={"resume_text": "CV", "jd_text": "JD", "company": "Acme", "role": "Dev"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "completed"
    assert data["agents_executed"] == ["OptimizerAgent", "TruthGateAgent"]
    assert data["candidate_approval_required"] is True
    assert data["submission_permitted"] is False
    assert "optimizer" in data["outputs"]
    assert "truth_gate" in data["outputs"]
