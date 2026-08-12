"""Candidate-authorised Omnisave AI API.

The public contract intentionally supports importing an article URL a candidate
selects. It does not claim to enumerate private saved-post lists from third
party services without a separate authorised integration.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, HttpUrl

from app.auth.dependencies import get_current_user
from app.services.llm_service import LLMNotConfiguredError, summarize_saved_post
from app.services.omnisave_service import get_omnisave_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["knowledge-hub"])


class SaveAnalyzeRequest(BaseModel):
    """Legacy enrichment endpoint; URL validation and authentication are required."""

    url: HttpUrl
    note: str = Field(default="", max_length=2_000)
    source: str = Field(default="other", max_length=40)


class SaveImportRequest(BaseModel):
    """A candidate-selected, public article URL to ingest into Omnisave."""

    url: HttpUrl


class KnowledgeQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_000)
    top_k: int = Field(default=3, ge=1, le=5)


class SaveSyncRequest(BaseModel):
    """Backwards-compatible explicit URL batch import; no account enumeration."""

    platforms: Optional[list[str]] = None
    urls: Optional[list[HttpUrl]] = None
    url: Optional[HttpUrl] = None


def _storage_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="knowledge_store_unavailable",
    )


@router.get("/saves")
async def get_saved_sources(user_id: str = Depends(get_current_user)):
    """List only sources durably stored for the authenticated candidate."""
    try:
        sources = await get_omnisave_service().list_user_saved_sources(user_id=user_id)
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise
    return {"success": True, "sources": sources}


@router.post("/saves/import", status_code=status.HTTP_201_CREATED)
async def import_public_saved_source(
    payload: SaveImportRequest,
    user_id: str = Depends(get_current_user),
):
    """Extract and durably save one candidate-provided public article URL."""
    result = await get_omnisave_service().import_public_url(user_id=user_id, url=str(payload.url))
    if result.get("success"):
        return result

    error = result.get("error", "import_failed")
    if error == "persistence_unavailable":
        raise _storage_unavailable()
    if error == "url_required":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="source_unavailable",
    )


@router.post("/saves/sync")
async def sync_agent_reach_saves(
    payload: SaveSyncRequest,
    user_id: str = Depends(get_current_user),
):
    """Compatibility endpoint for an explicit batch of candidate-selected URLs."""
    requested_urls = [str(url) for url in (payload.urls or [])]
    if payload.url:
        requested_urls.append(str(payload.url))
    try:
        result = await get_omnisave_service().sync_agent_reach_posts(
            user_id=user_id,
            platforms=payload.platforms,
            target_urls=requested_urls,
        )
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise
    if not result.get("success") and result.get("error") == "url_required":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="url_required")
    return result


@router.delete("/saves/{source_id}")
async def delete_saved_source(source_id: str, user_id: str = Depends(get_current_user)):
    """Permanently delete one source owned by the authenticated candidate."""
    try:
        deleted = await get_omnisave_service().delete_user_source(user_id=user_id, source_id=source_id)
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise
    if not deleted:
        # Do not disclose whether an ID belongs to another candidate.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="source_not_found")
    return {"success": True, "deleted": True, "source_id": source_id}


@router.post("/saves/analyze")
async def analyze_saved_post(
    payload: SaveAnalyzeRequest,
    _user_id: str = Depends(get_current_user),
):
    """Legacy AI enrichment, retained only as an authenticated helper."""
    try:
        return await summarize_saved_post(
            url=str(payload.url),
            note=payload.note,
            source=payload.source,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Omnisave legacy enrichment failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="ai_enrichment_failed") from exc


@router.post("/knowledge-hub/query")
async def query_knowledge_hub(
    payload: KnowledgeQueryRequest,
    user_id: str = Depends(get_current_user),
):
    """Answer only from the candidate's indexed sources and return citations."""
    try:
        result = await get_omnisave_service().query_knowledge_rag(
            query=payload.query,
            user_id=user_id,
            top_k=payload.top_k,
        )
        citations = [
            {
                "tag": citation.get("citation", f"[Source {index + 1}]"),
                "source_id": citation.get("source_id"),
                "title": citation.get("title", "Saved Article"),
                "author": citation.get("author", "Unknown"),
                "url": citation.get("url", "#"),
                "excerpt": citation.get("excerpt", ""),
            }
            for index, citation in enumerate(result.get("citations", []))
        ]
        return {"answer": result.get("answer", ""), "citations": citations}
    except LLMNotConfiguredError:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"error": "ai_service_unavailable"})
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        logger.error("Knowledge query runtime failure", exc_info=exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="knowledge_query_failed") from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("Knowledge query failed", exc_info=exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="knowledge_query_failed") from exc
