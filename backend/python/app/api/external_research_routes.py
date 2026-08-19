"""Authenticated, candidate-safe external research endpoints."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.services.capabilities import Capability, require_capability
from app.services.external_research import (
    ProviderNotConfigured,
    ProviderRejected,
    ResearchRequest,
    ResearchResponse,
    ResearchContext,
    provider_for,
)
from app.services.external_research_runs import (
    cancel_external_research_run,
    create_external_research_run,
    load_external_research_run_for_user,
    attach_external_research_task,
)
from app.services.provenance import ProvenanceError, ProvenanceUnavailable, payload_hash, provenance_service, sha256_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/integrations", tags=["External research"])


class ResearchJobAccepted(BaseModel):
    job_id: str
    provider: Literal["apify"]
    status: str
    provider_run_id: str | None = None


class ResearchJobStatus(BaseModel):
    job_id: str
    provider: Literal["apify"]
    status: str
    provider_run_id: str | None = None
    result: ResearchResponse | None = None
    result_count: int = 0
    truncated: bool = False
    error_code: str | None = None
    error_message: str | None = None


@router.post("/research", response_model=ResearchResponse | ResearchJobAccepted)
async def external_research(
    payload: ResearchRequest,
    request: Request,
    current_user: str = Depends(get_current_user),
) -> ResearchResponse | ResearchJobAccepted | JSONResponse:
    """Search public job/company information through an explicitly enabled provider."""
    require_capability(Capability.WORKSPACE_EXTERNAL_RESEARCH)
    provider_capability = {
        "firecrawl": Capability.WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL,
        "apify": Capability.WORKSPACE_EXTERNAL_RESEARCH_APIFY,
    }[payload.provider]
    require_capability(provider_capability)
    request_id = request.headers.get("X-Request-ID")
    # Tenant context is intentionally absent until the gateway supplies a typed,
    # membership-verified binding. Never trust X-Tenant-Id from a caller.
    context = ResearchContext(subject=current_user, tenant_id=None, request_id=request_id)

    if payload.provider == "apify":
        from app.tasks.external_research import run_apify_research

        idempotency_key = request.headers.get("Idempotency-Key") or f"external-research:{request_id or payload_hash(payload.model_dump())}:apify"
        job = await create_external_research_run(
            user_id=current_user,
            subject=current_user,
            request_id=request_id,
            idempotency_key=idempotency_key,
            query=payload.query,
            requested_limit=payload.limit,
            actor_id=os.getenv("APIFY_RESEARCH_ACTOR_ID", "").strip(),
            deadline_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
        if not job:
            raise HTTPException(status_code=503, detail={"code": "external_research_persistence_unavailable"})
        task = run_apify_research.apply_async(args=[str(job["job_id"])], queue="tayari")
        await attach_external_research_task(str(job["job_id"]), task.id)
        accepted = ResearchJobAccepted(
            job_id=str(job["job_id"]),
            provider="apify",
            status=str(job.get("status") or "accepted"),
            provider_run_id=job.get("provider_run_id"),
        )
        return JSONResponse(status_code=202, content=accepted.model_dump(mode="json"))

    provider = provider_for(payload.provider)
    try:
        response = await provider.search(payload, context)
        try:
            provenance = await provenance_service.create_artifact(
                user_id=current_user,
                artifact_type="external_research_result",
                content_hash=payload_hash(response.model_dump()),
                event_type="machine_imported",
                origin_actor="external_provider",
                producer_type=payload.provider,
                idempotency_key=f"external-research:{request_id or payload_hash(payload.model_dump())}:{payload.provider}",
                metadata={
                    "workflow": "external_research",
                    "provider": payload.provider,
                    "source_count": response.result_count,
                    "truncated": response.truncated,
                    "request_id": request_id,
                    "model_metadata_status": "not_applicable",
                },
                input_hashes=[sha256_text(payload.query)],
                output_hash=payload_hash(response.model_dump()),
                trace_id=request_id,
            )
            response.provenance = {
                "artifact_id": provenance["artifact_id"],
                "version_id": provenance["version_id"],
                "classification": "machine_imported",
                "policy_version": "ai-provenance-v1",
            }
        except ProvenanceUnavailable:
            logger.error("External research provenance storage unavailable provider=%s request_id=%s", payload.provider, request_id)
            response.provenance = {
                "status": "unavailable",
                "classification": "unknown",
                "reason": "durable_provenance_storage_unavailable",
            }
        except (ProvenanceError, ValueError) as exc:
            logger.error("External research provenance capture failed provider=%s request_id=%s", payload.provider, request_id)
            response.provenance = {
                "status": "failed",
                "classification": "unknown",
                "reason": "provenance_capture_failed",
            }
        return response
    except ProviderNotConfigured as exc:
        raise HTTPException(status_code=503, detail={"code": "external_provider_not_configured", "provider": payload.provider}) from exc
    except ProviderRejected as exc:
        logger.info("External research request rejected provider=%s request_id=%s reason=%s", payload.provider, request_id, exc)
        raise HTTPException(status_code=502, detail={"code": "external_provider_rejected", "provider": payload.provider}) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail={"code": "external_provider_timeout", "provider": payload.provider}) from exc


@router.get("/research/{job_id}", response_model=ResearchJobStatus)
async def external_research_status(job_id: str, current_user: str = Depends(get_current_user)) -> ResearchJobStatus:
    require_capability(Capability.WORKSPACE_EXTERNAL_RESEARCH)
    require_capability(Capability.WORKSPACE_EXTERNAL_RESEARCH_APIFY)
    row = await load_external_research_run_for_user(job_id, current_user)
    if not row:
        raise HTTPException(status_code=404, detail={"code": "external_research_job_not_found"})
    result: ResearchResponse | None = None
    if row.get("status") == "succeeded" and isinstance(row.get("result"), dict):
        try:
            result = ResearchResponse.model_validate(row["result"])
        except ValueError:
            result = None
    return ResearchJobStatus(
        job_id=str(row["job_id"]), provider="apify", status=str(row["status"]),
        provider_run_id=row.get("provider_run_id"), result=result,
        result_count=int(row.get("result_count") or 0), truncated=bool(row.get("truncated")),
        error_code=row.get("error_code"), error_message=row.get("error_message"),
    )


@router.post("/research/{job_id}/cancel", response_model=ResearchJobStatus)
async def cancel_external_research(job_id: str, current_user: str = Depends(get_current_user)) -> ResearchJobStatus:
    require_capability(Capability.WORKSPACE_EXTERNAL_RESEARCH)
    require_capability(Capability.WORKSPACE_EXTERNAL_RESEARCH_APIFY)
    row = await cancel_external_research_run(job_id, current_user)
    if not row:
        raise HTTPException(status_code=404, detail={"code": "external_research_job_not_found_or_terminal"})
    return ResearchJobStatus(job_id=str(row["job_id"]), provider="apify", status="cancelled")
