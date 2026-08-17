import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.services.provenance import ProvenanceUnavailable, provenance_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def override_identity():
    app.dependency_overrides[get_current_user] = lambda: "user-a"
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_provenance_list_is_owner_scoped(monkeypatch):
    async def fake_list(**kwargs):
        assert kwargs["user_id"] == "user-a"
        assert kwargs["classifications"] == ["ai_assisted"]
        return [{"id": "artifact-a", "user_id": "user-a", "origin_classification": "ai_assisted"}]

    monkeypatch.setattr(provenance_service, "list_artifacts", fake_list)
    response = client.get("/api/v1/provenance/artifacts?origin=ai_assisted")
    assert response.status_code == 200
    assert response.json()["artifacts"][0]["user_id"] == "user-a"


def test_provenance_disclosure_is_derived_server_side(monkeypatch):
    seen = {}

    async def fake_compute(**kwargs):
        seen.update(kwargs)
        return {
            "disclosure_id": "disclosure-a",
            "artifact_id": kwargs["artifact_id"],
            "classification": "ai_assisted",
            "user_label": "Created with AI assistance",
            "reason_codes": ["AI_CONTRIBUTION_RECORDED", "HUMAN_REVIEW_RECORDED"],
        }

    monkeypatch.setattr(provenance_service, "compute_disclosure", fake_compute)
    response = client.post(
        "/api/v1/provenance/artifacts/artifact-a/disclosure",
        json={"channel": "internal"},
    )
    assert response.status_code == 200
    assert response.json()["classification"] == "ai_assisted"
    assert seen == {"user_id": "user-a", "artifact_id": "artifact-a", "channel": "internal"}


def test_provenance_storage_outage_fails_closed(monkeypatch):
    async def unavailable(**kwargs):
        raise ProvenanceUnavailable("database unavailable")

    monkeypatch.setattr(provenance_service, "list_artifacts", unavailable)
    response = client.get("/api/v1/provenance/artifacts")
    assert response.status_code == 503
    assert response.json() == {"detail": "provenance_storage_unavailable"}


def test_provenance_export_has_stable_schema(monkeypatch):
    async def fake_export(**kwargs):
        assert kwargs["user_id"] == "user-a"
        return {
            "schema": "tayari.ai-provenance.export.v1",
            "policy_version": "ai-provenance-v1",
            "evaluator_version": "disclosure-evaluator-v1",
            "owner_id": "user-a",
            "count": 0,
            "completeness": {"unknown_artifacts": 0, "provenance_complete": 0},
            "artifacts": [],
        }

    monkeypatch.setattr(provenance_service, "export_artifacts", fake_export)
    response = client.get("/api/v1/provenance/export")
    assert response.status_code == 200
    assert response.json()["schema"] == "tayari.ai-provenance.export.v1"
    assert response.json()["owner_id"] == "user-a"
