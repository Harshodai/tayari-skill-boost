from fastapi import APIRouter, HTTPException

from app.services import automation_engine

router = APIRouter()

@router.get("/v1/resume-graph/{run_id}")
async def get_resume_graph(run_id: str):
    """Retrieve stored resume knowledge‑graph for the given run.

    Looks in the in‑memory ``_autopilot_store`` first; if not found, attempts to
    load the run from the DB (via ``automation_engine._read_run_blocking``).
    Returns ``{'run_id': run_id, 'graph': <graph>}`` on success.
    """
    store = automation_engine._autopilot_store.get(run_id)
    if store and "graph" in store:
        return {"run_id": run_id, "graph": store["graph"]}
    # Fallback: try DB load (synchronous helper) – may contain a ``graph`` field.
    loaded = automation_engine._read_run_blocking(run_id)
    if loaded and "graph" in loaded:
        return {"run_id": run_id, "graph": loaded["graph"]}
    raise HTTPException(status_code=404, detail=f"Resume graph not found for run_id={run_id}")
