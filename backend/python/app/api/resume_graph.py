from fastapi import APIRouter, HTTPException, Request, Response, Query
from fastapi.responses import JSONResponse
import logging
import time
from typing import Any, Dict, List

from pydantic import BaseModel

from app.services import automation_engine
from app.services.resume_graph_storage import store_graph, load_graph, delete_graph
from app.services.resume_parser import parse_resume

router = APIRouter()

logger = logging.getLogger(__name__)

# Simple in‑process rate‑limiter: max 5 requests per minute per IP
_RATE_LIMIT: Dict[str, List[float]] = {}
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMIT_MAX = 5


class GraphData(BaseModel):
    links: List[Any] = []  # renamed from edges
    nodes: List[Dict[str, Any]]
    total_nodes: int
    page: int
    size: int

    class Config:
        schema_extra = {
            "example": {
                "nodes": [{"id": 1, "label": "Skill"}],
                "links": [],
                "total_nodes": 1,
                "page": 1,
                "size": 10,
            }
        }


class GraphResponse(BaseModel):
    run_id: str
    graph: GraphData

    class Config:
        schema_extra = {
            "example": {
                "run_id": "example-run",
                "graph": {
                    "nodes": [{"id": 1, "label": "Skill"}],
                    "links": [],
                    "total_nodes": 1,
                    "page": 1,
                    "size": 10,
                },
            }
        }


@router.get("/v1/resume-graph/{run_id}", response_model=GraphResponse)
async def get_resume_graph(
    run_id: str,
    request: Request,
    response: Response,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1),
    format: str | None = Query(None, regex="^raw$"),
) -> GraphResponse | dict:
    """Retrieve stored resume knowledge‑graph for the given run.

    Pagination is applied to the ``nodes`` list. The endpoint is rate‑limited to
    ``_RATE_LIMIT_MAX`` requests per ``_RATE_LIMIT_WINDOW`` seconds per client IP.
    Security headers are added to the response.
    """
    # Rate limiting
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    timestamps = _RATE_LIMIT.get(ip, [])
    timestamps = [t for t in timestamps if now - t < _RATE_LIMIT_WINDOW]
    if len(timestamps) >= _RATE_LIMIT_MAX:
        logger.warning("Rate limit exceeded for IP %s", ip)
        raise HTTPException(status_code=429, detail="Too many requests")
    timestamps.append(now)
    _RATE_LIMIT[ip] = timestamps

    # Security headers
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Retrieve stored graph
    store = automation_engine._autopilot_store.get(run_id)
    graph: Dict[str, Any] | None = None
    if store and "graph" in store:
        graph = store["graph"]
    else:
        # Fallback to DB loading (async helper)
        graph = await load_graph(run_id)

    if not graph:
        logger.info("Resume graph not found for run_id %s", run_id)
        raise HTTPException(status_code=404, detail="Resume graph not found")

    # Raw format support – return the stored graph directly without pagination/wrapper
    if format == "raw":
        logger.debug("Returning raw resume graph for run_id %s", run_id)
        return JSONResponse(content=graph)

    nodes = graph.get("nodes", [])
    links = graph.get("links", [])
    total_nodes = len(nodes)
    start = (page - 1) * size
    end = start + size
    paginated_nodes = nodes[start:end]

    logger.debug(
        "Returning resume graph for run_id %s: page %s size %s total %s",
        run_id,
        page,
        size,
        total_nodes,
    )
    return GraphResponse(
        run_id=run_id,
        graph=GraphData(
            nodes=paginated_nodes,
            links=links,
            total_nodes=total_nodes,
            page=page,
            size=size,
        ),
    )


class ResumeGraphRequest(BaseModel):
    run_id: str
    resume_text: str


@router.post("/v1/resume-graph")
async def post_resume_graph(request: ResumeGraphRequest) -> Dict[str, Any]:
    """Parse a resume and store its knowledge‑graph for a given run.

    Returns the stored graph. 404 if the ``run_id`` is unknown, 400 if parsing fails.
    """
    run_id = request.run_id
    store = automation_engine._autopilot_store.get(run_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Run not found")
    graph = parse_resume(request.resume_text)
    if graph is None:
        raise HTTPException(status_code=400, detail="Resume parsing failed")
    store["graph"] = graph
    # Persist to DB (best‑effort, no‑op if DB disabled)
    await store_graph(run_id, graph)
    return {"run_id": run_id, "graph": graph}


@router.delete("/v1/resume-graph/{run_id}")
async def delete_resume_graph(run_id: str) -> Response:
    """Delete stored resume graph for a run.

    Removes the ``graph`` entry from the in‑process store if present.
    Returns 204 No Content on success.
    """
    store = automation_engine._autopilot_store.get(run_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if "graph" in store:
        del store["graph"]
        logger.info("Deleted resume graph for run_id %s", run_id)
        # Persist deletion to DB (best‑effort)
        await delete_graph(run_id)
    else:
        logger.info("No graph to delete for run_id %s", run_id)
    return Response(status_code=204)


@router.get("/v1/resume-graph/{run_id}/export")
async def export_resume_graph(run_id: str) -> Response:
    """Export the stored resume graph as a downloadable JSON file.

    Returns ``application/json`` with a ``Content‑Disposition`` attachment header.
    """
    store = automation_engine._autopilot_store.get(run_id)
    if store is not None and "graph" in store:
        graph = store["graph"]
    else:
        # Fallback to DB persistence
        graph = await load_graph(run_id)
        if graph is None:
            raise HTTPException(status_code=404, detail="Resume graph not found")
    import json
    content = json.dumps(graph).encode("utf-8")
    headers = {
        "Content-Disposition": f'attachment; filename="resume-graph-{run_id}.json"'
    }
    return Response(content=content, media_type="application/json", headers=headers)

