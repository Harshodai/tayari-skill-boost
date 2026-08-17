"""Preference profile read + refresh endpoints.

- ``GET  /api/v1/preferences``        — compute + return the caller's profile.
- ``POST /api/v1/preferences/refresh`` — force a matview refresh then return.

Both require ``X-User-Id``. The profile is computed on demand by
:func:`preference_learning.run_preference_learning` (TF-IDF over feedback
signals); the materialized view is the persisted layer. No CRUD table —
feedback rows are the source of truth, the matview is the cache, the response
is the derived view (ponytail: YAGNI a separate user_preference_profiles table).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, APIRouter, HTTPException, Header
from app.auth.dependencies import get_current_user
from pydantic import BaseModel, Field

from app.services.preference_learning import run_preference_learning
from app.services.event_log import log_feedback_event, list_feedback_events, VALID_FEEDBACK_TYPES

logger = logging.getLogger(__name__)

preference_router = APIRouter(prefix="/api/v1/preferences", tags=["preferences"])


def _require_user(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header is required")
    return x_user_id


class FeedbackRequest(BaseModel):
    job_id: str = Field(..., min_length=1)
    feedback_type: str = Field(..., description="liked|disliked|applied|skipped|saved")
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    metadata: Optional[dict] = None


@preference_router.get("")
async def get_preferences(x_user_id: str = Depends(get_current_user)) -> dict:
    user_id = _require_user(x_user_id)
    return await run_preference_learning(user_id)


@preference_router.post("/refresh")
async def refresh_preferences(x_user_id: str = Depends(get_current_user)) -> dict:
    user_id = _require_user(x_user_id)
    return await run_preference_learning(user_id)


# ---------------------------------------------------------------------------
# Feedback signals (write side of the preference layer)
# ---------------------------------------------------------------------------

@preference_router.post("/feedback")
async def post_feedback(
    payload: FeedbackRequest,
    x_user_id: str = Depends(get_current_user),
) -> dict:
    user_id = _require_user(x_user_id)
    if payload.feedback_type not in VALID_FEEDBACK_TYPES:
        raise HTTPException(status_code=400, detail=f"feedback_type must be one of {sorted(VALID_FEEDBACK_TYPES)}")
    ok = await log_feedback_event(
        user_id=user_id,
        job_id=payload.job_id,
        feedback_type=payload.feedback_type,
        job_title=payload.job_title,
        company_name=payload.company_name,
        metadata=payload.metadata,
    )
    return {"success": ok}


@preference_router.get("/feedback")
async def list_feedback(
    x_user_id: str = Depends(get_current_user),
    feedback_type: Optional[str] = None,
) -> dict:
    user_id = _require_user(x_user_id)
    if feedback_type and feedback_type not in VALID_FEEDBACK_TYPES:
        raise HTTPException(status_code=400, detail="invalid feedback_type filter")
    events = await list_feedback_events(user_id, feedback_type=feedback_type)
    return {"events": events}