
import hmac
import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from pydantic import BaseModel
from app.services.llm_service import LLMNotConfiguredError, is_llm_configured
from app.services.capabilities import Capability, capability_enabled
from app.telemetry import metrics
try:
    from fastapi_cache.decorator import cache
except ImportError:
    def cache(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

router = APIRouter()

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_status: str

@router.get("/healthz", response_model=HealthResponse)
@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
@router.get("/api/v1/health", response_model=HealthResponse)
@cache(expire=60)
def health_check():
    try:
        configured = is_llm_configured()
    except LLMNotConfiguredError:
        # Liveness must remain stable in development and local smoke tests. The
        # readiness endpoint is responsible for failing closed in production.
        configured = False
    return HealthResponse(
        status="ok",
        service="python-ai-engine",
        version="1.0.0",
        model_status="loaded" if configured else "llm_not_configured",
    )


@router.get("/api/v1/capabilities")
@router.get("/capabilities")
def capability_manifest():
    """Expose non-secret runtime capability state as the backend authority."""
    environment = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
    release_scope = os.getenv("RELEASE_SCOPE", "candidate_controlled_workspace").strip() or "candidate_controlled_workspace"
    autonomous = {
        Capability.AUTONOMOUS_BROWSER,
        Capability.AUTONOMOUS_ATS_SUBMIT,
        Capability.AUTONOMOUS_GMAIL,
        Capability.AUTONOMOUS_MESSAGING,
        Capability.AUTONOMOUS_BILLING,
        Capability.AUTONOMOUS_IRREVERSIBLE,
        Capability.WORKSPACE_COMPUTER_SUBMISSION,
    }
    entries = []
    for capability in Capability:
        enabled = capability_enabled(capability)
        state = "enabled" if enabled else "disabled"
        reason = None
        if capability in autonomous and not enabled:
            reason = "high_risk_capability_disabled_by_launch_scope"
        elif not enabled:
            reason = "capability_flag_disabled"
        entries.append({
            "capability": capability.value,
            "state": state,
            "environment": environment,
            "release_scope": release_scope,
            "risk_class": "high" if capability in autonomous else "candidate_controlled",
            "reason": reason,
            "evidence_class": "runtime_capability_registry",
        })
    provider_requirements = {
        "opensandbox": (Capability.WORKSPACE_ISOLATED_COMPUTER, ("OPENSANDBOX_API_URL", "OPENSANDBOX_API_TOKEN", "OPENSANDBOX_IMAGE")),
        "firecrawl": (Capability.WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL, ("FIRECRAWL_API_KEY",)),
        "apify": (Capability.WORKSPACE_EXTERNAL_RESEARCH_APIFY, ("APIFY_API_TOKEN", "APIFY_RESEARCH_ACTOR_ID", "APIFY_ALLOWED_ACTORS")),
        "a2a": (Capability.INTEGRATION_A2A_FEDERATION, ("A2A_FEDERATION_SECRET", "A2A_ALLOWED_PEERS")),
        "gmail": (Capability.AUTONOMOUS_GMAIL, ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET")),
        "stripe": (Capability.AUTONOMOUS_BILLING, ("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET")),
    }
    providers = []
    for provider, (capability, required_env) in provider_requirements.items():
        enabled = capability_enabled(capability)
        configured = all(bool(os.getenv(name, "").strip()) for name in required_env)
        if not enabled:
            state = "disabled"
            reason = "capability_disabled_by_launch_scope"
        elif not configured:
            state = "unconfigured"
            reason = "required_provider_configuration_missing"
        else:
            state = "configured_unverified"
            reason = "credentials_present_but_no_live_probe_in_health_endpoint"
        providers.append({
            "provider": provider,
            "capability": capability.value,
            "state": state,
            "required_configuration": list(required_env),
            "reason": reason,
            "evidence_class": "configuration_presence_only",
        })
    return {"status": "ok", "environment": environment, "release_scope": release_scope, "capabilities": entries, "providers": providers}


@router.get("/metrics")
async def metrics_snapshot(request: Request):
    """Return internal counters only to an authenticated monitoring caller."""
    expected = os.getenv("METRICS_TOKEN") or os.getenv("AI_INTERNAL_TOKEN", "")
    if not expected:
        return JSONResponse(
            status_code=503,
            content={"detail": "metrics authentication is not configured"},
        )
    provided = request.headers.get("X-Internal-Token", "")
    if not provided or not hmac.compare_digest(provided, expected):
        return JSONResponse(status_code=401, content={"detail": "metrics authentication required"})
    return metrics.snapshot()


@router.get("/readyz")
async def readiness_check():
    """Return 503 until required production dependencies are reachable."""
    if os.getenv("ENV", "development").lower() == "production":
        try:
            configured = is_llm_configured()
        except LLMNotConfiguredError:
            configured = False
        if not configured:
            raise HTTPException(status_code=503, detail="llm_not_configured")
    from app.services.db import get_pool
    pool = await get_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception as exc:  # noqa: BLE001 - readiness must fail closed
        raise HTTPException(status_code=503, detail="database_unavailable") from exc
    return {"status": "ready", "service": "python-ai-engine"}
