from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request, Response, Query
from fastapi.responses import JSONResponse
import logging
import time
from typing import Any, Dict, List

from pydantic import BaseModel, ConfigDict

from app.services import automation_engine, resume_parser
from app.services.resume_graph_storage import store_graph, load_graph, delete_graph

router = APIRouter()

logger = logging.getLogger(__name__)

# Simple in‑process rate‑limiter: max 5 requests per minute per IP
_RATE_LIMIT: Dict[str, List[float]] = {}
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMIT_MAX = 5
_RATE_LIMIT_MAX_KEYS = 10_000  # bound the store; evict stale keys when exceeded


def _rate_limit_check(key: str, now: float) -> None:
    """Enforce the per-key window, evicting stale keys and bounding the store.

    Raises HTTPException(429) when the key's window is exhausted. Stale keys
    are pruned on every call; when the store is still at the key bound and the
    incoming key is new, reject rather than evict active entries.
    """
    if len(_RATE_LIMIT) >= _RATE_LIMIT_MAX_KEYS:
        stale = [k for k, ts in _RATE_LIMIT.items() if not ts or now - ts[-1] >= _RATE_LIMIT_WINDOW]
        for k in stale:
            del _RATE_LIMIT[k]
    if key not in _RATE_LIMIT and len(_RATE_LIMIT) >= _RATE_LIMIT_MAX_KEYS:
        logger.warning("Rate limiter store full; rejecting new key %s", key)
        raise HTTPException(status_code=429, detail="Too many requests")

    timestamps = _RATE_LIMIT.get(key, [])
    timestamps = [t for t in timestamps if now - t < _RATE_LIMIT_WINDOW]
    if len(timestamps) >= _RATE_LIMIT_MAX:
        logger.warning("Rate limit exceeded for %s", key)
        raise HTTPException(status_code=429, detail="Too many requests")
    timestamps.append(now)
    _RATE_LIMIT[key] = timestamps


class GraphData(BaseModel):
    links: List[Any] = []  # renamed from edges
    nodes: List[Dict[str, Any]]
    total_nodes: int
    page: int
    size: int

    model_config = ConfigDict(json_schema_extra={"example": {"nodes": [{"id": 1, "label": "Skill"}], "links": [], "total_nodes": 1, "page": 1, "size": 10}})


class GraphResponse(BaseModel):
    run_id: str
    graph: GraphData

    model_config = ConfigDict(json_schema_extra={"example": {"run_id": "example-run", "graph": {"nodes": [{"id": 1, "label": "Skill"}], "links": [], "total_nodes": 1, "page": 1, "size": 10}}})


@router.get("/v1/resume-graph/{run_id}", response_model=GraphResponse)
async def get_resume_graph(
    run_id: str,
    request: Request,
    response: Response,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1),
    format: str | None = Query(None, pattern="^raw$"),
) -> GraphResponse | dict:
    """Retrieve stored resume knowledge‑graph for the given run.

    Pagination is applied to the ``nodes`` list. The endpoint is rate‑limited to
    ``_RATE_LIMIT_MAX`` requests per ``_RATE_LIMIT_WINDOW`` seconds per client IP.
    Security headers are added to the response.
    """
    # Rate limiting — keyed on the authenticated user (X-User-Id forwarded by
    # the Go gateway) so each user gets their own window; the raw client IP is
    # unusable behind the proxy because every request arrives from the gateway's
    # container IP, which would make the limit global across all users.
    # Trust boundary: the gateway overwrites any client-supplied X-User-Id with
    # the authenticated user (getXUserHeaders), and python-ai is only exposed on
    # the internal compose network, so this header is trustworthy.
    ip = request.client.host if request.client else "unknown"
    key = request.headers.get("x-user-id") or ip
    _rate_limit_check(key, time.time())

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
    graph = resume_parser.parse_resume(request.resume_text)
    if graph is None:
        raise HTTPException(status_code=400, detail="Resume parsing failed")
    store["graph"] = graph
    # Persist to DB (best‑effort, no‑op if DB disabled)
    await store_graph(run_id, graph)
    return {"run_id": run_id, "graph": graph}


@router.delete("/v1/resume-graph/{run_id}")
async def delete_resume_graph(run_id: str) -> Response:
    """Delete stored resume graph for a run.

    Removes the ``graph`` entry from the in‑process store if present, and
    best‑effort deletes the persisted DB row even when the run is only known
    to the DB (e.g. loaded from storage after an in‑process restart).
    Returns 204 No Content on success, 404 when neither store holds the run.
    """
    store = automation_engine._autopilot_store.get(run_id)
    had_in_memory = store is not None and "graph" in store
    if had_in_memory:
        del store["graph"]
        logger.info("Deleted resume graph for run_id %s", run_id)

    # Check the DB fallback even when the in‑process store was empty: the run
    # may only exist as a persisted row (the common case after a restart).
    persisted = await load_graph(run_id) is not None

    if not had_in_memory and not persisted:
        raise HTTPException(status_code=404, detail="Run not found")

    # Persist deletion to DB (best‑effort, no‑op if disabled).
    await delete_graph(run_id)
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

