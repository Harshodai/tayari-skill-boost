import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import app, rate_limit_key


client = TestClient(app)


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/strategic/analyze", {"resume_text": "synthetic resume"}),
        ("/api/v1/strategic/entities", {"resume_text": "synthetic resume"}),
        (
            "/api/v1/strategic/inject",
            {"experience_bullets": ["built a service"], "missing_keywords": ["Python"]},
        ),
        ("/api/v1/strategic/ai-proof", {"resume_text": "synthetic resume"}),
        ("/api/v1/profile/import-text", {"resume_text": "synthetic resume"}),
        ("/api/v1/export/json", {"resume_json": {"name": "Synthetic Candidate"}}),
        ("/api/v1/ats/keywords", {"resume_text": "synthetic resume"}),
        (
            "/api/v1/ats/evaluate-5d",
            {"resume_text": "synthetic resume", "job_description": "synthetic job"},
        ),
        ("/api/v1/browser/automation", {"instruction": "synthetic task"}),
        ("/api/v1/browser/automation/stream", {"instruction": "synthetic task"}),
        ("/api/v1/browser/automation/cancel", {"run_id": "synthetic-run"}),
    ],
)
def test_private_ai_and_parser_routes_reject_anonymous_requests(path, payload):
    response = client.post(path, json=payload)
    assert response.status_code == 401, (path, response.text)


def _request_with_headers(headers, client_ip="203.0.113.10"):
    return Request({
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
        "client": (client_ip, 1234),
    })


def test_rate_limit_key_is_user_and_ip_scoped():
    anonymous = rate_limit_key(_request_with_headers({}))
    user_a_ip_1 = rate_limit_key(_request_with_headers({"X-User-Id": "user-a"}))
    user_a_ip_2 = rate_limit_key(_request_with_headers({"X-User-Id": "user-a"}, "203.0.113.11"))
    user_b_ip_1 = rate_limit_key(_request_with_headers({"X-User-Id": "user-b"}))

    assert anonymous == "anon:ip:203.0.113.10"
    assert user_a_ip_1 == "user:user-a:ip:203.0.113.10"
    assert user_a_ip_1 != user_a_ip_2
    assert user_a_ip_1 != user_b_ip_1


def test_rate_limit_key_uses_validated_gateway_client_ip_over_container_peer():
    gateway_a = rate_limit_key(_request_with_headers({"X-Tayari-Client-IP": "198.51.100.7"}, "172.19.0.8"))
    gateway_b = rate_limit_key(_request_with_headers({"X-Tayari-Client-IP": "198.51.100.8"}, "172.19.0.8"))
    malformed = rate_limit_key(_request_with_headers({"X-Tayari-Client-IP": "not-an-ip"}, "172.19.0.8"))

    assert gateway_a == "anon:ip:198.51.100.7"
    assert gateway_b == "anon:ip:198.51.100.8"
    assert gateway_a != gateway_b
    assert malformed == "anon:ip:172.19.0.8"


def test_private_browser_control_route_rejects_anonymous_requests():
    response = client.get("/api/v1/browser/automation/runs/synthetic-run/control")
    assert response.status_code == 401


def test_public_quick_ats_scan_is_text_only_and_bounded():
    response = client.post(
        "/api/v1/ats/score",
        json={"resume_text": "Python SQL", "job_description": "Python"},
    )
    assert response.status_code == 200
    assert response.json()["score"] == 100

    oversized = client.post(
        "/api/v1/ats/score",
        json={"resume_text": "x" * 20_001, "job_description": "Python"},
    )
    assert oversized.status_code == 422
