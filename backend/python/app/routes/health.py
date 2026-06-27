
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.llm_service import active_engine
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

@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
@cache(expire=60)
def health_check():
    return HealthResponse(
        status="ok",
        service="python-ai-engine",
        version="1.0.0",
        model_status="loaded" if active_engine() != "mock-fallback" else "llm_not_configured",
    )
