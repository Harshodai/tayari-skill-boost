import json
from typing import Dict, Any

from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.services import automation_engine

client = TestClient(app)
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


def _dummy_graph(node_count: int = 5) -> Dict[str, Any]:
    """Create a simple dummy graph with ``node_count`` nodes."""
    nodes = [{"id": i, "label": f"Node{i}"} for i in range(1, node_count + 1)]
    return {"nodes": nodes, "links": []}


def test_delete_resume_graph_success() -> None:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        run_id = "delete-test"
        automation_engine._autopilot_store[run_id] = {"graph": _dummy_graph(), "user_id": TEST_USER_ID}
        response = client.delete(f"/v1/resume-graph/{run_id}")
        assert response.status_code == 204
        # Graph should be removed but the run entry may remain
        store = automation_engine._autopilot_store.get(run_id, {})
        assert "graph" not in store
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_delete_resume_graph_not_found() -> None:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        run_id = "nonexistent-delete"
        automation_engine._autopilot_store.pop(run_id, None)
        response = client.delete(f"/v1/resume-graph/{run_id}")
        assert response.status_code == 404
        assert "Run not found" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_export_resume_graph_success() -> None:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        run_id = "export-test"
        graph = _dummy_graph(3)
        automation_engine._autopilot_store[run_id] = {"graph": graph, "user_id": TEST_USER_ID}
        response = client.get(f"/v1/resume-graph/{run_id}/export")
        assert response.status_code == 200
        cd = response.headers.get("content-disposition")
        assert cd is not None and f"resume-graph-{run_id}.json" in cd
        # Body should be the raw graph JSON
        assert response.json() == graph
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_get_resume_graph_raw_format() -> None:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        from app.api.resume_graph import _RATE_LIMIT
        _RATE_LIMIT.clear()
        run_id = "raw-format-test"
        graph = _dummy_graph(2)
        automation_engine._autopilot_store[run_id] = {"graph": graph, "user_id": TEST_USER_ID}
        response = client.get(f"/v1/resume-graph/{run_id}?format=raw")
        assert response.status_code == 200
        # Raw endpoint returns the graph directly (no wrapper)
        assert response.json() == graph
    finally:
        app.dependency_overrides.pop(get_current_user, None)
