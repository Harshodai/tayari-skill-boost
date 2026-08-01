import os
import pytest
from fastapi import HTTPException
from app.api.a2a_routes import verify_a2a_auth


@pytest.mark.asyncio
async def test_verify_a2a_auth_fails_closed_when_key_unset(monkeypatch):
    monkeypatch.delenv("TAYARI_API_KEY", raising=False)
    monkeypatch.delenv("A2A_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        await verify_a2a_auth(authorization="Bearer secret123")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_verify_a2a_auth_missing_header(monkeypatch):
    monkeypatch.setenv("TAYARI_API_KEY", "test-secret")
    with pytest.raises(HTTPException) as exc_info:
        await verify_a2a_auth(authorization=None)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_verify_a2a_auth_invalid_token(monkeypatch):
    monkeypatch.setenv("TAYARI_API_KEY", "test-secret")
    with pytest.raises(HTTPException) as exc_info:
        await verify_a2a_auth(authorization="Bearer wrong-secret")
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_verify_a2a_auth_success(monkeypatch):
    monkeypatch.setenv("TAYARI_API_KEY", "test-secret")
    # Should not raise any exception
    await verify_a2a_auth(authorization="Bearer test-secret")
