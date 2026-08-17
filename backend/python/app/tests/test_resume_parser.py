import json
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.services import automation_engine

client = TestClient(app)
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


def test_post_resume_graph_success() -> None:
    """POST stores parsed graph and returns it when run exists."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        run_id = "test-run-success"
        # Ensure run entry exists in store with owner
        automation_engine._autopilot_store[run_id] = {"user_id": TEST_USER_ID}
        dummy_graph = {"nodes": [{"id": 1, "label": "Skill"}], "links": []}
        with patch("app.services.resume_parser.parse_resume", return_value=dummy_graph):
            response = client.post(
                "/v1/resume-graph",
                json={"run_id": run_id, "resume_text": "some resume content"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["run_id"] == run_id
        assert data["graph"] == dummy_graph
        # Verify stored in in‑memory cache
        assert automation_engine._autopilot_store[run_id]["graph"] == dummy_graph
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_post_resume_graph_missing_run() -> None:
    """POST returns 404 when run_id not found."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        run_id = "nonexistent-run"
        automation_engine._autopilot_store.pop(run_id, None)
        response = client.post(
            "/v1/resume-graph",
            json={"run_id": run_id, "resume_text": "text"},
        )
        assert response.status_code == 404
        assert "Run not found" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_post_resume_graph_parse_failure() -> None:
    """POST returns 400 when resume parsing returns None."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        run_id = "run-parse-fail"
        automation_engine._autopilot_store[run_id] = {"user_id": TEST_USER_ID}
        with patch("app.services.resume_parser.parse_resume", return_value=None):
            response = client.post(
                "/v1/resume-graph",
                json={"run_id": run_id, "resume_text": "bad"},
            )
        assert response.status_code == 400
        assert "Resume parsing failed" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
