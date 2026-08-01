"""
A2A FastAPI Route Handlers.
Exposes /.well-known/agent-card.json and authenticated /api/v1/a2a/dispatch.
"""
import os
import hmac
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from app.a2a.models import A2AMessage, A2AResponse, AgentCard
from app.a2a.registry import AgentRegistry
from app.a2a.dispatcher import A2ADispatcher

router = APIRouter(tags=["A2A Protocol"])


async def verify_a2a_auth(authorization: Optional[str] = Header(None)):
    """Authenticate A2A dispatch requests using TAYARI_API_KEY / A2A_API_KEY. Fails closed if unset."""
    expected_key = os.getenv("TAYARI_API_KEY") or os.getenv("A2A_API_KEY")
    if not expected_key:
        raise HTTPException(status_code=401, detail="A2A API key not configured")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = parts[1].strip()
    if not hmac.compare_digest(token, expected_key):
        raise HTTPException(status_code=403, detail="Invalid A2A authentication token")


@router.get("/.well-known/agent-card.json", response_model=AgentCard, dependencies=[Depends(verify_a2a_auth)])
async def get_agent_card(request: Request):
    """Serve standard A2A Agent Card for capability discovery."""
    base_url = str(request.base_url).rstrip("/")
    registry = AgentRegistry.get_instance()
    return registry.get_system_agent_card(host_url=base_url)


@router.post("/api/v1/a2a/dispatch", response_model=A2AResponse, dependencies=[Depends(verify_a2a_auth)])
async def dispatch_a2a_message(message: A2AMessage):
    """Receive and dispatch an A2A message to target specialized agent."""
    dispatcher = A2ADispatcher.get_instance()
    return await dispatcher.dispatch(message)
