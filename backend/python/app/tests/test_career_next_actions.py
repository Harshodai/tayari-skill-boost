import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.career_intelligence import _generate_career_actions, CareerAction

client = TestClient(app)

def test_next_actions_requires_authentication():
    response = client.get("/api/v1/career/next-actions")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_career_actions_truthful_empty_state(monkeypatch):
    # When user has no resumes/applications/portals, return empty list
    async def mock_get_pool():
        return None

    monkeypatch.setattr("app.api.career_intelligence.get_pool", mock_get_pool)
    actions = await _generate_career_actions("test-user-empty")
    assert actions == []


@pytest.mark.asyncio
async def test_generate_career_actions_with_simulated_data(monkeypatch):
    class MockConnection:
        async def fetch(self, query, *args):
            if "resumes" in query:
                return [{
                    "id": 101,
                    "title": "Software Engineer Resume",
                    "original_text": "Experienced developer built APIs. Increased throughput by 25%.",
                    "status": "uploaded",
                    "updated_at": "2026-09-01T00:00:00Z"
                }]
            elif "applications" in query:
                return [{
                    "id": 201,
                    "application_id": "app-201",
                    "company": "Acme Corp",
                    "role": "Backend Lead",
                    "status": "applied",
                    "updated_at": "2026-08-25T00:00:00Z"
                }]
            elif "user_portals" in query:
                return [{
                    "id": 301,
                    "name": "Stripe",
                    "careers_url": "https://stripe.com/jobs",
                    "enabled": True,
                    "updated_at": "2026-08-20T00:00:00Z"
                }]
            elif "agent_action_approvals" in query:
                return []
            return []

    class MockPool:
        def acquire(self):
            class AsyncContext:
                async def __aenter__(self):
                    return MockConnection()
                async def __aexit__(self, exc_type, exc_val, exc_tb):
                    pass
            return AsyncContext()

    async def mock_get_pool():
        return MockPool()

    monkeypatch.setattr("app.api.career_intelligence.get_pool", mock_get_pool)

    actions = await _generate_career_actions("test-user-123")
    assert len(actions) > 0
    assert len(actions) <= 7

    allowed_badges = {"verified", "candidate_confirmed", "inferred", "illustrative", "unavailable"}
    for action in actions:
        assert action.action_id
        assert action.type
        assert action.title
        assert action.why_now
        assert action.effort_estimate_mins > 0
        assert 0.0 <= action.confidence <= 1.0
        assert action.status_badge in allowed_badges
        assert action.freshness_ts
        assert action.required_action_by_candidate
