from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.internal_gateway import InternalGatewayMiddleware


def build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(InternalGatewayMiddleware)

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/v1/expensive")
    async def expensive() -> dict[str, bool]:
        return {"ok": True}

    return app


def test_development_allows_local_requests(monkeypatch):
    monkeypatch.setenv("ENV", "development")
    monkeypatch.delenv("AI_INTERNAL_TOKEN", raising=False)
    response = TestClient(build_app()).get("/api/v1/expensive")
    assert response.status_code == 200


def test_production_health_is_available_without_service_token(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("AI_INTERNAL_TOKEN", raising=False)
    response = TestClient(build_app()).get("/health")
    assert response.status_code == 200


def test_production_fails_closed_when_secret_is_missing(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("AI_INTERNAL_TOKEN", raising=False)
    response = TestClient(build_app()).get("/api/v1/expensive")
    assert response.status_code == 503


def test_production_rejects_missing_or_wrong_service_token(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("AI_INTERNAL_TOKEN", "correct-secret")
    client = TestClient(build_app())

    assert client.get("/api/v1/expensive").status_code == 401
    assert client.get(
        "/api/v1/expensive", headers={"X-Internal-Token": "wrong-secret"}
    ).status_code == 401


def test_production_accepts_the_configured_service_token(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("AI_INTERNAL_TOKEN", "correct-secret")
    response = TestClient(build_app()).get(
        "/api/v1/expensive", headers={"X-Internal-Token": "correct-secret"}
    )
    assert response.status_code == 200
