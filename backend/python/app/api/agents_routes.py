"""FastAPI endpoints for Digital Employees and Runtime Tool Approvals.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field

from app.services import agent_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["agents"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class AgentCreateRequest(BaseModel):
    name: str
    role: str = "Agent"
    remark_name: Optional[str] = None
    instructions: Optional[str] = None
    traits: list[str] = Field(default_factory=list)
    active: bool = True
    runtime_id: Optional[str] = None


class AgentInstructionsUpdateRequest(BaseModel):
    instructions: str


class ApprovalUpdateRequest(BaseModel):
    status: str  # "approved" or "rejected"
    reviewer_comment: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def get_required_user_id(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header is required")
    return x_user_id


# ---------------------------------------------------------------------------
# Digital Employees Endpoints
# ---------------------------------------------------------------------------

@router.get("/agents")
async def get_agents(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    user_id = get_required_user_id(x_user_id)
    agents = await agent_db.list_digital_employees(user_id)
    return {"agents": agents}


@router.post("/agents")
async def create_agent(
    payload: AgentCreateRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    success = await agent_db.create_or_update_digital_employee(
        user_id=user_id,
        name=payload.name,
        role=payload.role,
        remark_name=payload.remark_name,
        instructions=payload.instructions,
        traits=payload.traits,
        active=payload.active,
        runtime_id=payload.runtime_id
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create/update digital employee")
    return {"status": "ok", "message": "Agent saved successfully"}


@router.put("/agents/{name}/instructions")
async def update_agent_instructions(
    name: str,
    payload: AgentInstructionsUpdateRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    agent = await agent_db.get_digital_employee(user_id, name)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    success = await agent_db.create_or_update_digital_employee(
        user_id=user_id,
        name=name,
        role=agent["role"],
        remark_name=agent["remark_name"],
        instructions=payload.instructions,
        traits=agent["traits"],
        active=agent["active"],
        runtime_id=agent["runtime_id"]
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update instructions")
    return {"status": "ok"}


@router.delete("/agents/{name}")
async def delete_agent(
    name: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    success = await agent_db.delete_digital_employee(user_id, name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete agent")
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Approvals Endpoints
# ---------------------------------------------------------------------------

@router.get("/approvals")
async def get_approvals(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    user_id = get_required_user_id(x_user_id)
    approvals = await agent_db.list_runtime_approvals(user_id)
    return {"approvals": approvals}


@router.put("/approvals/{approval_id}")
async def update_approval(
    approval_id: str,
    payload: ApprovalUpdateRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    approval = await agent_db.get_runtime_approval(user_id, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
        
    if approval["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Approval is already in {approval['status']} state")

    success = await agent_db.update_runtime_approval(
        user_id=user_id,
        approval_id=approval_id,
        status=payload.status,
        reviewer_comment=payload.reviewer_comment
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update approval status")
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Hermes Config Endpoints
# ---------------------------------------------------------------------------

@router.get("/hermes/config")
async def get_hermes_config(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    user_id = get_required_user_id(x_user_id)
    
    # Generate the custom config.yaml contents for local Hermes Agent configuration.
    config_yaml = f"""# Tayari synced Hermes Agent Configuration
# Place this file in ~/.hermes/config.yaml or %USERPROFILE%\\.hermes\\config.yaml

gateway:
  type: "http"
  endpoint: "https://api.tayari.app/api/v1/hermes"
  token: "tayari_{user_id.replace('-', '')}"

providers:
  tayari:
    label: "Tayari AI Platform"
    base_url: "https://api.tayari.app/api/v1"
    api_key: "tayari_{user_id.replace('-', '')}"
    default_model: "gpt-4o-mini"
"""
    return {
        "config_yaml": config_yaml,
        "filename": "config.yaml"
    }


# ---------------------------------------------------------------------------
# Agent Tasks & Event Logs Endpoints (AgentSpace In-Depth)
# ---------------------------------------------------------------------------

class TaskCreateRequest(BaseModel):
    title: str
    input_json: Optional[dict] = None


@router.post("/agents/{agent_id}/tasks")
async def enqueue_agent_task(
    agent_id: str,
    payload: TaskCreateRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    
    # Write to database in 'queued' status
    task_id = await agent_db.create_agent_task(
        user_id=user_id,
        agent_id=agent_id,
        title=payload.title,
        input_json=payload.input_json
    )
    if not task_id:
        raise HTTPException(status_code=500, detail="Failed to enqueue agent task in database")
        
    # Trigger Celery background worker execution
    from app.tasks.automation import run_agent_task
    run_agent_task.apply_async(
        args=(task_id, user_id, agent_id, payload.input_json or {}),
        queue="tayari"
    )
    
    return {"status": "ok", "task_id": task_id}


@router.get("/agents/tasks")
async def get_all_agent_tasks(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    tasks = await agent_db.list_agent_tasks(user_id)
    return {"tasks": tasks}


@router.get("/agents/{agent_id}/tasks")
async def get_agent_tasks(
    agent_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    tasks = await agent_db.list_agent_tasks(user_id, agent_id)
    return {"tasks": tasks}


@router.get("/agents/tasks/{task_id}")
async def get_task_details(
    task_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    task = await agent_db.get_agent_task(user_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Agent task not found")
    return {"task": task}


@router.get("/agents/tasks/{task_id}/events")
async def get_task_events(
    task_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
):
    user_id = get_required_user_id(x_user_id)
    events = await agent_db.list_agent_router_events(user_id, task_id)
    return {"events": events}
