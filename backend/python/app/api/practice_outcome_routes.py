"""Authenticated preparation outcome endpoints.

The route records only bounded, consented progress metadata and never accepts raw
answers or transcripts as part of the outcome contract.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.services.practice_outcomes import (
    COMPLETION_STATUSES,
    INTERVIEW_OUTCOMES,
    list_practice_outcomes,
    record_practice_outcome,
)

router = APIRouter(prefix="/api/v1/preparation", tags=["preparation-outcomes"])


class PracticeOutcomeRequest(BaseModel):
    practice_session_id: str = Field(..., min_length=1, max_length=160)
    application_id: Optional[str] = Field(default=None, max_length=160)
    completion_status: str = Field(..., description="started|partial|completed|skipped")
    confidence: int = Field(..., ge=0, le=100)
    interview_outcome: str = Field(default="unknown")
    correction_note: Optional[str] = Field(default=None, max_length=1000)
    consent_acknowledged: bool = False
    expires_at: Optional[datetime] = None


@router.post("/outcomes")
async def post_practice_outcome(
    payload: PracticeOutcomeRequest,
    x_user_id: str = Depends(get_current_user),
) -> dict:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    if payload.completion_status not in COMPLETION_STATUSES:
        raise HTTPException(status_code=400, detail="invalid completion_status")
    if payload.interview_outcome not in INTERVIEW_OUTCOMES:
        raise HTTPException(status_code=400, detail="invalid interview_outcome")
    outcome = await record_practice_outcome(x_user_id, payload.model_dump())
    if outcome is None:
        if not payload.consent_acknowledged:
            raise HTTPException(status_code=400, detail="consent_acknowledged must be true")
        raise HTTPException(status_code=503, detail="practice outcome storage unavailable")
    return {"outcome": outcome}


@router.get("/outcomes")
async def get_practice_outcomes(
    x_user_id: str = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    return {"outcomes": await list_practice_outcomes(x_user_id, limit=limit)}
