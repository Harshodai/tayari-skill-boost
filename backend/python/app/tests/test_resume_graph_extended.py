import json
from typing import Dict, Any

from fastapi.testclient import TestClient

from app.main import app
from app.services import automation_engine

client = TestClient(app)


def _dummy_graph(node_count: int = 5) -> Dict[str, Any]:
    """Create a simple dummy graph with ``node_count`` nodes."""
    nodes = [{"id": i, "label": f"Node{i}"} for i in range(1, node_count + 1)]
    return {"nodes": nodes, "links": []}


def test_delete_resume_graph_success() -> None:
    run_id = "delete-test"
    automation_engine._autopilot_store[run_id] = {"graph": _dummy_graph()}
    response = client.delete(f"/v1/resume-graph/{run_id}")
    assert response.status_code == 204
    # Graph should be removed but the run entry may remain
    store = automation_engine._autopilot_store.get(run_id, {})
    assert "graph" not in store


def test_delete_resume_graph_not_found() -> None:
    run_id = "nonexistent-delete"
    automation_engine._autopilot_store.pop(run_id, None)
    response = client.delete(f"/v1/resume-graph/{run_id}")
    assert response.status_code == 404
    assert "Run not found" in response.json()["detail"]


def test_export_resume_graph_success() -> None:
    run_id = "export-test"
    graph = _dummy_graph(3)
    automation_engine._autopilot_store[run_id] = {"graph": graph}
    response = client.get(f"/v1/resume-graph/{run_id}/export")
    assert response.status_code == 200
    cd = response.headers.get("content-disposition")
    assert cd is not None and f"resume-graph-{run_id}.json" in cd
    # Body should be the raw graph JSON
    assert response.json() == graph


def test_get_resume_graph_raw_format() -> None:
    run_id = "raw-format-test"
    graph = _dummy_graph(2)
    automation_engine._autopilot_store[run_id] = {"graph": graph}
    response = client.get(f"/v1/resume-graph/{run_id}?format=raw")
    assert response.status_code == 200
    # Raw endpoint returns the graph directly (no wrapper)
    assert response.json() == graph
