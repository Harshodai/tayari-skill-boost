import os
import pytest
from fastapi import HTTPException
from starlette.requests import Request
from app.api.a2a_routes import verify_a2a_auth


def request():
    return Request({"type": "http", "method": "POST", "path": "/api/v1/a2a/dispatch", "headers": [], "query_string": b"", "server": ("testserver", 80), "scheme": "http"})


@pytest.fixture(autouse=True)
def enable_a2a_scope(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("CAPABILITY_INTEGRATION_A2A_FEDERATION", "true")


@pytest.mark.asyncio
async def test_verify_a2a_auth_fails_closed_when_key_unset(monkeypatch):
    monkeypatch.delenv("TAYARI_API_KEY", raising=False)
    monkeypatch.delenv("A2A_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        await verify_a2a_auth(request=request(), authorization="Bearer secret123")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_verify_a2a_auth_missing_header(monkeypatch):
    monkeypatch.setenv("TAYARI_API_KEY", "test-secret")
    with pytest.raises(HTTPException) as exc_info:
        await verify_a2a_auth(request=request(), authorization=None)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_verify_a2a_auth_invalid_token(monkeypatch):
    monkeypatch.setenv("TAYARI_API_KEY", "test-secret")
    with pytest.raises(HTTPException) as exc_info:
        await verify_a2a_auth(request=request(), authorization="Bearer wrong-secret")
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_verify_a2a_auth_success(monkeypatch):
    monkeypatch.setenv("TAYARI_API_KEY", "test-secret")
    # Should not raise any exception
    await verify_a2a_auth(request=request(), authorization="Bearer test-secret")
