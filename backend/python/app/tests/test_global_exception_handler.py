"""Unit tests for the FastAPI global exception handler in app.main."""
import pytest
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from app.main import app, global_exception_handler


@pytest.fixture(scope="module")
def test_client():
    # Define test-specific routes on app
    @app.get("/test-error/http-exception")
    async def endpoint_http_exception():
        raise HTTPException(status_code=404, detail="Custom item not found")

    @app.get("/test-error/starlette-http-exception")
    async def endpoint_starlette_http_exception():
        raise StarletteHTTPException(status_code=403, detail="Custom access denied")

    @app.post("/test-error/validation-error")
    async def endpoint_validation_error(value: int):
        return {"value": value}

    @app.get("/test-error/unhandled-runtime-error")
    async def endpoint_runtime_error():
        raise RuntimeError("Something exploded unexpectedly")

    @app.get("/test-error/unhandled-value-error")
    async def endpoint_value_error():
        raise ValueError("Invalid internal state")

    return TestClient(app, raise_server_exceptions=False)


def test_http_exception_not_suppressed(test_client):
    """HTTPException (4xx) should preserve status code and detail, not turn into 500."""
    response = test_client.get("/test-error/http-exception")
    assert response.status_code == 404
    assert response.json() == {"detail": "Custom item not found"}


def test_starlette_http_exception_not_suppressed(test_client):
    """StarletteHTTPException (4xx) should preserve status code and detail."""
    response = test_client.get("/test-error/starlette-http-exception")
    assert response.status_code == 403
    assert response.json() == {"detail": "Custom access denied"}


def test_request_validation_error_not_suppressed(test_client):
    """RequestValidationError (422) should preserve validation errors, not turn into 500."""
    response = test_client.post("/test-error/validation-error", json={"value": "not-an-integer"})
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert any(err["loc"] == ["body", "value"] or "value" in str(err["loc"]) for err in data["detail"])


def test_unhandled_runtime_error_returns_500(test_client):
    """Unhandled RuntimeError should return 500 with sanitized Internal Server Error detail."""
    response = test_client.get("/test-error/unhandled-runtime-error")
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal Server Error"}


def test_unhandled_value_error_returns_500(test_client):
    """Unhandled ValueError should return 500 with sanitized Internal Server Error detail."""
    response = test_client.get("/test-error/unhandled-value-error")
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal Server Error"}


@pytest.mark.asyncio
async def test_direct_handler_invocation():
    """Verify direct invocation of global_exception_handler behaves correctly."""
    scope = {"type": "http", "method": "GET", "path": "/test", "headers": []}
    request = Request(scope)

    # Unhandled general exception
    resp_general = await global_exception_handler(request, RuntimeError("Crash"))
    assert resp_general.status_code == 500
    assert resp_general.body == b'{"detail":"Internal Server Error"}'

    # HTTPException delegation
    resp_http = await global_exception_handler(request, HTTPException(status_code=400, detail="Bad input"))
    assert resp_http.status_code == 400

    # StarletteHTTPException delegation
    resp_starlette = await global_exception_handler(request, StarletteHTTPException(status_code=401, detail="Unauthorized"))
    assert resp_starlette.status_code == 401

    # RequestValidationError delegation
    val_err = RequestValidationError(errors=[{"loc": ("body", "test"), "msg": "field required", "type": "value_error.missing"}])
    resp_val = await global_exception_handler(request, val_err)
    assert resp_val.status_code == 422
