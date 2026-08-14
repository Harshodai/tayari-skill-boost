from fastapi.testclient import TestClient

from app.main import app


def test_approval_listing_rejects_identity_header_without_verified_auth():
    client = TestClient(app)
    response = client.get(
        "/api/v1/approvals",
        headers={"X-User-Id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 401


def test_approval_update_rejects_identity_header_without_verified_auth():
    client = TestClient(app)
    response = client.put(
        "/api/v1/approvals/00000000-0000-0000-0000-000000000001",
        headers={"X-User-Id": "00000000-0000-0000-0000-000000000001"},
        json={"status": "approved"},
    )
    assert response.status_code == 401
