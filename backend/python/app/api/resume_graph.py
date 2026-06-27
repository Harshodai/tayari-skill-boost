'''Resume Knowledge Graph API.

Provides a simple endpoint to retrieve the resume knowledge graph parsed by the optional
``open_resume`` library during an autopilot run.
'''

from fastapi import APIRouter, HTTPException

from ..services.automation_engine import _autopilot_store

router = APIRouter(prefix="/v1/resume-graph", tags=["resume_graph"])

@router.get("/{run_id}")
async def get_resume_graph(run_id: str):
    """Return the knowledge‑graph for a given autopilot run if available."""
    run = _autopilot_store.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    graph = run.get("resume_graph")
    if not graph:
        raise HTTPException(status_code=404, detail="Resume graph not available")
    return {"run_id": run_id, "graph": graph}
