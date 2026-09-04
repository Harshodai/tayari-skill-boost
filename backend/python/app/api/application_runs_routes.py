"""FastAPI routes for Canonical Application State Machine and Action Ledger (WP-03)."""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.services.application_lifecycle import (
    InvalidApplicationTransition,
    create_application_run,
    get_application_run,
    log_action,
    reconcile_receipt,
    transition_state,
)

router = APIRouter(prefix="/api/v1", tags=["application-runs"])


class CreateApplicationRunRequest(BaseModel):
    job_id: Optional[str] = None
    resume_version_hash: Optional[str] = None
    cover_letter_version_hash: Optional[str] = None
    initial_state: str = "prepared"


class TransitionApplicationRunRequest(BaseModel):
    new_state: str
    actor: str = "candidate"
    evidence: dict[str, Any] = Field(default_factory=dict)


class LogActionRequest(BaseModel):
    action_type: str
    idempotency_key: str
    status: str = "pending"
    receipt: Optional[dict[str, Any]] = None
    external_url: Optional[str] = None


class ReconcileReceiptRequest(BaseModel):
    receipt_hash: str


@router.post("/application-runs")
async def create_run_endpoint(
    payload: CreateApplicationRunRequest,
    user_id: str = Depends(get_current_user),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    try:
        created = await create_application_run(
            user_id=user_id,
            job_id=payload.job_id,
            resume_version_hash=payload.resume_version_hash,
            cover_letter_version_hash=payload.cover_letter_version_hash,
            initial_state=payload.initial_state,
        )
        return created
    except InvalidApplicationTransition as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/application-runs/{id}")
async def get_run_endpoint(
    id: str,
    user_id: str = Depends(get_current_user),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    run = await get_application_run(id, user_id)
    if not run:
        raise HTTPException(status_code=404, detail="Application run not found")
    return run


@router.post("/application-runs/{id}/transition")
async def transition_run_endpoint(
    id: str,
    payload: TransitionApplicationRunRequest,
    user_id: str = Depends(get_current_user),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    try:
        updated = await transition_state(
            run_id=id,
            new_state=payload.new_state,
            actor=payload.actor,
            evidence=payload.evidence,
            user_id=user_id,
        )
        return updated
    except InvalidApplicationTransition as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        if "not found" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc))
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/application-runs/{id}/actions")
async def log_action_endpoint(
    id: str,
    payload: LogActionRequest,
    user_id: str = Depends(get_current_user),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    try:
        return await log_action(
            run_id=id,
            user_id=user_id,
            action_type=payload.action_type,
            idempotency_key=payload.idempotency_key,
            status=payload.status,
            receipt=payload.receipt,
            external_url=payload.external_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/application-runs/{id}/reconcile-receipt")
async def reconcile_receipt_endpoint(
    id: str,
    payload: ReconcileReceiptRequest,
    user_id: str = Depends(get_current_user),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="authenticated user is required")
    try:
        return await reconcile_receipt(id, payload.receipt_hash, user_id)
    except (InvalidApplicationTransition, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
