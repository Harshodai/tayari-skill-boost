"""Authenticated outcome events & analytics routes (WP-09)."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.services.outcome_analytics import (
    ALLOWED_EVENT_TYPES,
    get_outcome_analytics,
    list_outcome_events,
    record_outcome_event,
)

router = APIRouter(prefix="/api/v1/outcomes", tags=["outcomes"])


class RecordOutcomeRequest(BaseModel):
    event_type: str = Field(..., description="saved|rejected|applied|interviewing|declined|offer|hired")
    application_run_id: Optional[str] = None
    is_candidate_confirmed: bool = True
    is_externally_verified: bool = False
    notes: Optional[str] = None


@router.post("")
async def post_outcome_event(
    payload: RecordOutcomeRequest,
    user_id: str = Depends(get_current_user),
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
) -> dict:
    """Record an outcome event. Client tokens cannot set is_externally_verified."""
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")

    event_type = payload.event_type.strip().lower()
    if event_type not in ALLOWED_EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"invalid event_type '{payload.event_type}'. Must be one of {sorted(ALLOWED_EVENT_TYPES)}",
        )

    # Only trusted service/internal caller can mark externally verified
    import hmac
    import os
    configured_token = os.getenv("AI_INTERNAL_TOKEN", "")
    is_service_role = bool(
        x_internal_token and configured_token and hmac.compare_digest(x_internal_token, configured_token)
    )

    result = await record_outcome_event(
        user_id=user_id,
        payload=payload.model_dump(),
        is_service_role=is_service_role,
    )

    if result is None:
        raise HTTPException(status_code=503, detail="outcome storage unavailable")

    return {"outcome": result}


@router.get("")
async def get_outcomes(
    user_id: str = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict:
    """List outcome events for the authenticated candidate."""
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    events = await list_outcome_events(user_id=user_id, limit=limit)
    return {"outcomes": events}


@router.get("/analytics")
async def get_analytics(
    user_id: str = Depends(get_current_user),
) -> dict:
    """Get outcome learning loop metrics with 95% Wilson confidence intervals."""
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    analytics = await get_outcome_analytics(user_id=user_id)
    return {"analytics": analytics}
