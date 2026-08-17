"""Authenticated, candidate-safe external research endpoints."""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

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
from app.services.provenance import ProvenanceError, ProvenanceUnavailable, payload_hash, provenance_service, sha256_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/integrations", tags=["External research"])


@router.post("/research", response_model=ResearchResponse)
async def external_research(
    payload: ResearchRequest,
    request: Request,
    current_user: str = Depends(get_current_user),
) -> ResearchResponse:
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
