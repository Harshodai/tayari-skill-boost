import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.middleware.request_budget import RequestBudgetMiddleware


@pytest.fixture
def client():
    app = FastAPI()
    calls = {"count": 0}

    @app.post("/echo")
    async def echo(request: Request):
        calls["count"] += 1
        return {"size": len(await request.body())}

    app.add_middleware(RequestBudgetMiddleware, max_body_bytes=4)
    return TestClient(app), calls


def test_declared_oversized_body_is_rejected_before_handler(client):
    test_client, calls = client
    response = test_client.post("/echo", content=b"12345")

    assert response.status_code == 413
    assert calls["count"] == 0
    assert response.headers["x-request-body-limit"] == "4"


def test_body_at_limit_reaches_handler(client):
    test_client, calls = client
    response = test_client.post("/echo", content=b"1234")

    assert response.status_code == 200
    assert response.json() == {"size": 4}
    assert calls["count"] == 1
