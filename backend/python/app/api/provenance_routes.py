"""Owner-scoped machine-readable AI provenance and disclosure endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.services.provenance import (
    ORIGIN_CLASSIFICATIONS,
    ProvenanceError,
    ProvenanceUnavailable,
    provenance_service,
)

router = APIRouter(prefix="/api/v1/provenance", tags=["AI Provenance"])


class DisclosureRequest(BaseModel):
    channel: str = Field(default="internal", min_length=1, max_length=64)


def _handle_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ProvenanceUnavailable):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="provenance_storage_unavailable",
        )
    if isinstance(exc, ValueError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    if isinstance(exc, KeyError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact_not_found")
    if isinstance(exc, ProvenanceError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="provenance_conflict")
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="provenance_request_failed")


@router.get("/artifacts")
async def list_provenance_artifacts(
    origin: Annotated[list[str] | None, Query()] = None,
    disclosure_status: str | None = Query(default=None, min_length=1, max_length=64),
    created_after: datetime | None = Query(default=None),
    created_before: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user),
):
    try:
        return {
            "schema": "tayari.ai-provenance.collection.v1",
            "policy_version": "ai-provenance-v1",
            "artifacts": await provenance_service.list_artifacts(
                user_id=user_id,
                classifications=origin,
                disclosure_status=disclosure_status,
                created_after=created_after,
                created_before=created_before,
                limit=limit,
                offset=offset,
            ),
        }
    except Exception as exc:  # noqa: BLE001 - mapped to a safe API error
        raise _handle_error(exc) from exc


@router.get("/artifacts/{artifact_id}")
async def get_provenance_artifact(
    artifact_id: str,
    user_id: str = Depends(get_current_user),
):
    try:
        detail = await provenance_service.get_artifact(user_id=user_id, artifact_id=artifact_id)
        if not detail:
            raise KeyError("artifact_not_found")
        return {
            "schema": "tayari.ai-provenance.artifact.v1",
            "policy_version": "ai-provenance-v1",
            **detail,
        }
    except Exception as exc:  # noqa: BLE001 - mapped to a safe API error
        raise _handle_error(exc) from exc


@router.post("/artifacts/{artifact_id}/disclosure")
async def compute_provenance_disclosure(
    artifact_id: str,
    payload: DisclosureRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        return {
            "schema": "tayari.ai-provenance.disclosure.v1",
            **await provenance_service.compute_disclosure(
                user_id=user_id,
                artifact_id=artifact_id,
                channel=payload.channel,
            ),
        }
    except Exception as exc:  # noqa: BLE001 - mapped to a safe API error
        raise _handle_error(exc) from exc


@router.get("/export")
async def export_provenance(
    origin: Annotated[list[str] | None, Query()] = None,
    created_after: datetime | None = Query(default=None),
    created_before: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    try:
        return await provenance_service.export_artifacts(
            user_id=user_id,
            classifications=origin,
            created_after=created_after,
            created_before=created_before,
            limit=limit,
        )
    except Exception as exc:  # noqa: BLE001 - mapped to a safe API error
        raise _handle_error(exc) from exc


__all__ = ["router", "ORIGIN_CLASSIFICATIONS"]
