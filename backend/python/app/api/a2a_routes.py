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
from app.a2a.federation import FederationRejected, verify_signed_federation_request
from app.a2a.authorization import A2APeerPrincipal, require_tenant_binding
from app.services.capabilities import Capability, require_capability

router = APIRouter(tags=["A2A Protocol"])


async def verify_a2a_auth(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_a2a_timestamp: Optional[str] = Header(None, alias="X-A2A-Timestamp"),
    x_a2a_nonce: Optional[str] = Header(None, alias="X-A2A-Nonce"),
    x_a2a_signature: Optional[str] = Header(None, alias="X-A2A-Signature"),
    x_a2a_peer_id: Optional[str] = Header(None, alias="X-A2A-Peer-ID"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
) -> A2APeerPrincipal:
    """Authenticate A2A with signed federation headers or development bearer auth."""
    environment = os.getenv("APP_ENV", "development").strip().lower()
    peer_id = x_a2a_peer_id if isinstance(x_a2a_peer_id, str) else None
    tenant_id = x_tenant_id if isinstance(x_tenant_id, str) else None
    signed_request = any(
        isinstance(value, str) and value.strip()
        for value in (x_a2a_timestamp, x_a2a_nonce, x_a2a_signature)
    )
    if signed_request:
        require_capability(Capability.INTEGRATION_A2A_FEDERATION)
        try:
            await verify_signed_federation_request(
                secret=os.getenv("A2A_FEDERATION_SECRET", "").strip(),
                timestamp=x_a2a_timestamp,
                nonce=x_a2a_nonce,
                signature=x_a2a_signature,
                body=await request.body(),
                peer_id=peer_id,
            )
        except FederationRejected as exc:
            raise HTTPException(status_code=401, detail="Invalid signed A2A request") from exc
        principal = A2APeerPrincipal(peer_id=(peer_id or "").strip(), auth_mode="signed", tenant_id=(tenant_id or "").strip() or None)
        if not principal.peer_id or not require_tenant_binding(principal):
            raise HTTPException(status_code=403, detail="Signed A2A tenant and peer binding are required")
        return principal
    if environment in {"production", "prod", "staging"}:
        require_capability(Capability.INTEGRATION_A2A_FEDERATION)
        raise HTTPException(status_code=401, detail="Signed A2A authentication is required")
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
    return A2APeerPrincipal(peer_id=(peer_id or "development-client").strip(), auth_mode="development_bearer", tenant_id=(tenant_id or "").strip() or None)


@router.get("/.well-known/agent-card.json", response_model=AgentCard)
async def get_agent_card(request: Request, principal: A2APeerPrincipal = Depends(verify_a2a_auth)):
    """Serve standard A2A Agent Card for capability discovery."""
    base_url = str(request.base_url).rstrip("/")
    registry = AgentRegistry.get_instance()
    return registry.get_system_agent_card(host_url=base_url, principal=principal)


@router.post("/api/v1/a2a/dispatch", response_model=A2AResponse)
async def dispatch_a2a_message(message: A2AMessage, principal: A2APeerPrincipal = Depends(verify_a2a_auth)):
    """Receive and dispatch an A2A message after peer/skill authorization."""
    dispatcher = A2ADispatcher.get_instance()
    try:
        return await dispatcher.dispatch(message, principal=principal)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="A2A peer is not authorized for this skill") from exc
