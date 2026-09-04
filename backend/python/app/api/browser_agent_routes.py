"""
Browser automation routes for the Tayari AI Engine.
"""
import asyncio
import json as _json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Browser Automation"])

# --- browser agent authz + limits (WS-06 hardening) -----------------------
BROWSER_RUN_TIMEOUT_SECONDS = float(os.getenv("BROWSER_RUN_TIMEOUT_SECONDS", "300"))
BROWSER_CANCEL_TIMEOUT_SECONDS = float(os.getenv("BROWSER_CANCEL_TIMEOUT_SECONDS", "15"))
BROWSER_MAX_STEPS_CAP = int(os.getenv("BROWSER_MAX_STEPS_CAP", "50"))


def browser_actor(request: Request) -> str:
    """Resolve the authenticated caller forwarded by the Go gateway."""
    actor = (request.headers.get("X-User-Id") or "").strip()
    if not actor:
        logger.warning("[Audit] component=browser-agent action=%s actor=- outcome=denied reason=no-actor", request.url.path)
        raise HTTPException(status_code=401, detail="authentication required")
    return actor


def clamp_steps(value: Optional[int]) -> int:
    try:
        steps = int(value or 25)
    except (TypeError, ValueError):
        steps = 25
    return max(1, min(steps, BROWSER_MAX_STEPS_CAP))


def require_browser_automation_capabilities() -> None:
    """Gate browser execution on both the legacy agent and selected provider scope."""
    from app.services.capabilities import Capability, require_capability

    require_capability(Capability.AUTONOMOUS_BROWSER)
    provider = (os.getenv("BROWSER_PROVIDER") or "local").strip().lower()
    if provider == "opensandbox":
        require_capability(Capability.WORKSPACE_ISOLATED_COMPUTER)
    elif provider == "local_bridge":
        require_capability(Capability.WORKSPACE_LOCAL_BROWSER_BRIDGE)


class BrowserAutomationRequest(BaseModel):
    instruction: str
    max_steps: Optional[int] = 25
    run_id: Optional[str] = None


@router.post("/api/v1/browser/automation")
@router.post("/api/browser/automation")
async def browser_automation_endpoint(
    payload: BrowserAutomationRequest,
    request: Request,
    _user_id: str = Depends(get_current_user),
):
    """Execute autonomous browser instruction via browser-use + Playwright."""
    from app.services.capabilities import Capability, require_capability
    require_capability(Capability.AUTONOMOUS_BROWSER)
    require_browser_automation_capabilities()
    from app.services.browser_automation import run_browser_agent

    actor = _user_id
    steps = clamp_steps(payload.max_steps)
    run_id = (payload.run_id or "").strip() or None
    logger.info("[Audit] component=browser-agent action=run actor=%s run=%s outcome=started steps=%s", actor, run_id or "-", steps)
    try:
        result = await asyncio.wait_for(
            run_browser_agent(payload.instruction, max_steps=steps, owner_id=actor, run_id=run_id),
            timeout=BROWSER_RUN_TIMEOUT_SECONDS,
        )
        logger.info("[Audit] component=browser-agent action=run actor=%s run=- outcome=%s", actor, "ok" if result.success else "failed")
        return {
            "success": result.success,
            "instruction": result.instruction,
            "summary": result.summary,
            "visited_urls": result.visited_urls,
            "actions": result.actions,
            "error": result.error,
            "markdown": result.to_markdown(),
        }
    except asyncio.TimeoutError as exc:
        logger.warning("[Audit] component=browser-agent action=run actor=%s run=- outcome=timeout", actor)
        raise HTTPException(status_code=504, detail="browser run timed out") from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Audit] component=browser-agent action=run actor=%s outcome=error detail=%s", actor, exc)
        raise HTTPException(status_code=500, detail="browser automation failed") from exc


@router.post("/api/v1/browser/automation/stream")
async def browser_automation_stream_endpoint(
    payload: dict,
    request: Request,
    _user_id: str = Depends(get_current_user),
):
    """SSE stream of per-step browser screenshots for the Glass-Box live feed."""
    from app.services.capabilities import Capability, require_capability
    require_capability(Capability.AUTONOMOUS_BROWSER)
    require_browser_automation_capabilities()
    from app.services.browser_automation.agent import stream_browser_agent
    from app.services.db import load_agent_run

    actor = _user_id
    instruction = str(payload.get("instruction", ""))
    max_steps = clamp_steps(payload.get("max_steps"))
    run_id = payload.get("run_id") or None
    logger.info("[Audit] component=browser-agent action=stream actor=%s run=%s outcome=started", actor, run_id or "-")

    start_url: Optional[str] = None
    if run_id:
        run_record = await load_agent_run(str(run_id))
        if not run_record:
            logger.warning("[Audit] component=browser-agent action=stream actor=%s run=%s outcome=not-found", actor, run_id)
            raise HTTPException(status_code=404, detail="run not found")
        if str(run_record.get("user_id")) != str(actor):
            logger.warning("[Audit] component=browser-agent action=stream actor=%s run=%s outcome=denied", actor, run_id)
            raise HTTPException(status_code=403, detail="run does not belong to caller")
        config = run_record.get("config") or {}
        if isinstance(config, str):
            try:
                config = _json.loads(config)
            except Exception:
                config = {}
        candidate = (
            config.get("job_url")
            or config.get("url")
            or config.get("apply_url")
            or run_record.get("job_url")
        )
        if isinstance(candidate, str) and candidate.strip():
            start_url = candidate.strip()

    async def event_stream():
        try:
            async for event in stream_browser_agent(
                instruction, max_steps=max_steps, run_id=run_id, owner_id=actor,
                start_url=start_url,
            ):
                yield f"data: {_json.dumps(event)}\n\n"
            logger.info("[Audit] component=browser-agent action=stream actor=%s run=%s outcome=ok", actor, run_id or "-")
        except Exception as exc:
            logger.error("[Audit] component=browser-agent action=stream actor=%s run=%s outcome=error detail=%s", actor, run_id or "-", exc)
            yield f"data: {_json.dumps({'type': 'error', 'error': 'browser_agent_failed'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/v1/browser/automation/runs/{run_id}/control")
async def browser_automation_control_endpoint(
    run_id: str,
    request: Request,
    event_limit: int = Query(default=100, ge=0, le=1000),
    _user_id: str = Depends(get_current_user),
):
    """Return candidate-owned durable state for a browser-assisted run."""
    from app.services.capabilities import Capability, require_capability
    require_capability(Capability.AUTONOMOUS_BROWSER)
    require_browser_automation_capabilities()
    from app.services.run_control import (
        RunControlOwnershipError,
        RunControlStoreUnavailable,
        get_run_control_snapshot,
    )

    actor = _user_id
    normalized_run_id = str(run_id or "").strip()
    if not normalized_run_id:
        raise HTTPException(status_code=400, detail="run_id is required")
    try:
        snapshot = await get_run_control_snapshot(normalized_run_id, actor, event_limit=event_limit)
    except RunControlOwnershipError:
        logger.warning("[Audit] component=browser-agent action=control actor=%s run=%s outcome=forbidden", actor, normalized_run_id)
        raise HTTPException(status_code=403, detail="run belongs to another candidate")
    except RunControlStoreUnavailable:
        logger.error("[Audit] component=browser-agent action=control actor=%s run=%s outcome=storage_unavailable", actor, normalized_run_id)
        raise HTTPException(status_code=503, detail="durable run control is temporarily unavailable")
    if snapshot is None:
        logger.warning("[Audit] component=browser-agent action=control actor=%s run=%s outcome=missing", actor, normalized_run_id)
        raise HTTPException(status_code=404, detail="run not found")
    logger.info("[Audit] component=browser-agent action=control actor=%s run=%s outcome=ok", actor, normalized_run_id)
    return snapshot


@router.post("/api/v1/browser/automation/cancel")
async def browser_automation_cancel_endpoint(
    payload: dict,
    request: Request,
    _user_id: str = Depends(get_current_user),
):
    """WS-06 kill switch: terminate the isolated browser session for a run."""
    from app.services.capabilities import Capability, require_capability
    require_capability(Capability.AUTONOMOUS_BROWSER)
    require_browser_automation_capabilities()
    from app.services.browser_automation.session import BrowserAuthzError, cancel_run

    actor = _user_id
    run_id = str(payload.get("run_id") or "").strip()
    if not run_id:
        raise HTTPException(status_code=400, detail="run_id is required")

    logger.info("[Audit] component=browser-agent action=cancel actor=%s run=%s outcome=requested", actor, run_id)
    try:
        terminated = await asyncio.wait_for(
            cancel_run(run_id, owner_id=actor), timeout=BROWSER_CANCEL_TIMEOUT_SECONDS
        )
    except BrowserAuthzError as exc:
        logger.warning("[Audit] component=browser-agent action=cancel actor=%s run=%s outcome=denied", actor, run_id)
        raise HTTPException(status_code=403, detail="run does not belong to caller") from exc
    except asyncio.TimeoutError as exc:
        logger.error("[Audit] component=browser-agent action=cancel actor=%s run=%s outcome=timeout", actor, run_id)
        raise HTTPException(status_code=504, detail="cancel timed out") from exc

    logger.info(
        "[Audit] component=browser-agent action=cancel actor=%s run=%s outcome=%s",
        actor, run_id, "terminated" if terminated else "not-found",
    )
    return {"run_id": run_id, "terminated": terminated}
