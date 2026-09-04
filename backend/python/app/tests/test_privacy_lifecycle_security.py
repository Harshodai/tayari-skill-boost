import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.auth.dependencies import get_current_user


@pytest.fixture
def client():
    return TestClient(app)


def test_privacy_check_requires_authentication(client):
    """privacy_check_endpoint must reject unauthenticated requests."""
    app.dependency_overrides.pop(get_current_user, None)
    resp = client.get("/api/v1/privacy/check")
    assert resp.status_code in (401, 403)

    resp_post = client.post("/api/v1/privacy/check")
    assert resp_post.status_code in (401, 403)


def test_privacy_check_succeeds_for_authenticated_user(client):
    """privacy_check_endpoint must succeed when caller is authenticated."""
    app.dependency_overrides[get_current_user] = lambda: "test-user-id"
    try:
        with patch("app.services.privacy_check.check_privacy_and_offline_status") as mock_check:
            mock_check.return_value = {"status": "ok", "offline_mode": True}
            resp = client.get("/api/v1/privacy/check")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok", "offline_mode": True}
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_voice_feedback_requires_authentication(client):
    """voice_feedback_endpoint must reject unauthenticated callers."""
    app.dependency_overrides.pop(get_current_user, None)
    resp = client.post(
        "/api/v1/interview/voice-feedback",
        json={"transcript": "hello", "scenario": "intro"}
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_account_keeps_success_when_ledger_fails():
    """Account deletion must succeed even if audit ledger write raises an exception."""
    from app.api.privacy_lifecycle_routes import delete_user_account_endpoint
    from starlette.requests import Request

    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"authorization": "Bearer fake-token"}

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "application/json"}
    mock_resp.json.return_value = {"status": "deleted"}

    with patch("httpx.AsyncClient.delete", new_callable=AsyncMock) as mock_delete, \
         patch("app.services.privacy_ledger.ledger.record", new_callable=AsyncMock) as mock_record:
        mock_delete.return_value = mock_resp
        mock_record.side_effect = RuntimeError("database ledger outage")

        result = await delete_user_account_endpoint(mock_request, user_id="user-123")
        assert result["status"] == "ok"
        assert result["gateway_response"] == {"status": "deleted"}


@pytest.mark.asyncio
async def test_delete_account_preserves_error_status_when_ledger_fails():
    """Account deletion must preserve 4xx gateway error without crashing to 502 on ledger failure."""
    from app.api.privacy_lifecycle_routes import delete_user_account_endpoint
    from starlette.requests import Request

    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"authorization": "Bearer fake-token"}

    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_resp.headers = {"content-type": "application/json"}
    mock_resp.json.return_value = {"detail": "Account not found"}

    with patch("httpx.AsyncClient.delete", new_callable=AsyncMock) as mock_delete, \
         patch("app.services.privacy_ledger.ledger.record", new_callable=AsyncMock) as mock_record:
        mock_delete.return_value = mock_resp
        mock_record.side_effect = RuntimeError("database ledger outage")

        with pytest.raises(HTTPException) as exc_info:
            await delete_user_account_endpoint(mock_request, user_id="user-123")
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Account not found"
