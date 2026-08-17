import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


@pytest.fixture
def disabled_autonomous_scope(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AI_INTERNAL_TOKEN", "test-internal-token")
    for name in (
        "CAPABILITY_AUTONOMOUS_BROWSER",
        "CAPABILITY_AUTONOMOUS_GMAIL",
        "CAPABILITY_AUTONOMOUS_ATS_SUBMIT",
        "CAPABILITY_AUTONOMOUS_BILLING",
    ):
        monkeypatch.delenv(name, raising=False)
    return {
        "X-Internal-Token": "test-internal-token",
        "X-User-Id": "00000000-0000-0000-0000-000000000001",
    }


def assert_disabled(response, capability: str):
    assert response.status_code == 423, (response.status_code, response.text)
    body = response.json()
    assert body["detail"]["code"] == "disabled_by_launch_scope"
    assert body["detail"]["capability"] == capability


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("post", "/api/v1/browser/automation", {"instruction": "synthetic task"}),
        ("post", "/api/v1/browser/automation/stream", {"instruction": "synthetic task"}),
        ("get", "/api/v1/browser/automation/runs/synthetic-run/control", None),
        ("post", "/api/v1/browser/automation/cancel", {"run_id": "synthetic-run"}),
    ],
)
def test_browser_routes_are_disabled_by_launch_scope(disabled_autonomous_scope, method, path, payload):
    response = client.request(method.upper(), path, json=payload, headers=disabled_autonomous_scope)
    assert_disabled(response, "autonomous.browser")


def test_gmail_parser_is_disabled_by_launch_scope(disabled_autonomous_scope):
    response = client.post(
        "/api/v1/gmail/parse-email",
        json={"email_text": "Your application status has changed."},
        headers=disabled_autonomous_scope,
    )
    assert_disabled(response, "autonomous.gmail")


def test_external_research_is_disabled_by_launch_scope(disabled_autonomous_scope):
    response = client.post(
        "/api/v1/integrations/research",
        json={"query": "public senior engineering jobs", "provider": "firecrawl", "limit": 5},
        headers=disabled_autonomous_scope,
    )
    assert_disabled(response, "workspace.external_research")


def test_provider_specific_research_capability_is_independent(disabled_autonomous_scope, monkeypatch):
    monkeypatch.setenv("CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH", "true")
    monkeypatch.delenv("CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL", raising=False)
    response = client.post(
        "/api/v1/integrations/research",
        json={"query": "public senior engineering jobs", "provider": "firecrawl", "limit": 5},
        headers=disabled_autonomous_scope,
    )
    assert_disabled(response, "workspace.external_research.firecrawl")
