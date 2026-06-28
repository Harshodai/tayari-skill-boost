import pytest
from fastapi.testclient import TestClient
from typing import Dict, Any, List

from app.main import app
from app.services import automation_engine

client = TestClient(app)


def _create_dummy_graph(node_count: int = 25) -> Dict[str, Any]:
    """Create a dummy graph with ``node_count`` sequential nodes."""
    nodes = [{"id": i, "label": f"Node{i}"} for i in range(1, node_count + 1)]
    return {"nodes": nodes, "links": []}


def test_get_resume_graph_pagination() -> None:
    """Successful retrieval with pagination parameters."""
    run_id = "test-pagination"
    dummy_graph = _create_dummy_graph(25)
    automation_engine._autopilot_store[run_id] = {"graph": dummy_graph}

    page = 2
    size = 10
    response = client.get(f"/v1/resume-graph/{run_id}?page={page}&size={size}")
    assert response.status_code == 200
    data = response.json()
    assert data["run_id"] == run_id
    # Nodes should be the slice 11-20 (10 nodes)
    expected_nodes = [{"id": i, "label": f"Node{i}"} for i in range(11, 21)]
    graph = data["graph"]
    assert graph["nodes"] == expected_nodes
    assert graph["links"] == []
    assert graph["total_nodes"] == 25
    assert graph["page"] == page
    assert graph["size"] == size


def test_get_resume_graph_not_found() -> None:
    """Endpoint returns 404 when the run_id does not exist."""
    run_id = "nonexistent-run"
    automation_engine._autopilot_store.pop(run_id, None)
    response = client.get(f"/v1/resume-graph/{run_id}")
    assert response.status_code == 404
    assert "Resume graph not found" in response.json()["detail"]


def test_security_headers_present() -> None:
    """Validate that security headers are set on a successful response."""
    run_id = "header-test"
    dummy_graph = _create_dummy_graph(5)
    automation_engine._autopilot_store[run_id] = {"graph": dummy_graph}
    response = client.get(f"/v1/resume-graph/{run_id}")
    assert response.status_code == 200
    # Header names are case‑insensitive, FastAPI returns them as they were set.
    assert response.headers.get("Content-Security-Policy") == "default-src 'self'"
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
