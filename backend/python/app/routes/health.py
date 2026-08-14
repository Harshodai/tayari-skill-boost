
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm_service import active_engine, is_llm_configured
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
    return HealthResponse(
        status="ok",
        service="python-ai-engine",
        version="1.0.0",
        model_status="loaded" if is_llm_configured() else "llm_not_configured",
    )


@router.get("/readyz")
async def readiness_check():
    """Return 503 until required production dependencies are reachable."""
    if os.getenv("ENV", "development").lower() == "production" and not is_llm_configured():
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
