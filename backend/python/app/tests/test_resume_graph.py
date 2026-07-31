import json
from typing import Dict, Any
from fastapi.testclient import TestClient

from app.main import app
from app.services import automation_engine

client = TestClient(app)


def test_get_resume_graph_success() -> None:
    """Insert a dummy graph into the in-memory store and verify the endpoint returns it."""
    run_id: str = "test-run-1"
    dummy_graph: Dict[str, Any] = {"nodes": [{"id": 1, "label": "Skill"}], "links": []}
    # Directly mutate the in-process cache used by the endpoint.
    automation_engine._autopilot_store[run_id] = {"graph": dummy_graph}
    response = client.get(f"/v1/resume-graph/{run_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["run_id"] == run_id
    # The endpoint wraps the stored graph with pagination metadata.
    assert data["graph"]["nodes"] == dummy_graph["nodes"]
    assert data["graph"]["links"] == dummy_graph["links"]
    assert data["graph"]["total_nodes"] == 1
    assert data["graph"]["page"] == 1
    assert data["graph"]["size"] == 10


def test_get_resume_graph_not_found() -> None:
    """When the run_id is missing, the API should return 404."""
    run_id = "nonexistent-run"
    automation_engine._autopilot_store.pop(run_id, None)
    response = client.get(f"/v1/resume-graph/{run_id}")
    assert response.status_code == 404
    assert "Resume graph not found" in response.json()["detail"]
