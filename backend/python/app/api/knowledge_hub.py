"""Candidate-authorised Omnisave AI API.

The public contract intentionally supports importing an article URL a candidate
selects. It does not claim to enumerate private saved-post lists from third
party services without a separate authorised integration.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, HttpUrl

from app.auth.dependencies import get_current_user
from app.services.llm_service import LLMNotConfiguredError, summarize_saved_post
from app.services.omnisave_evidence import get_omnisave_evidence_store
from app.services.omnisave_brief import get_omnisave_brief_service
from app.services.omnisave_service import get_omnisave_service
from app.services.omnisave_sync import get_omnisave_sync_store
from app.services.omnisave_seed import _normalise_url, get_omnisave_seed_store

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


class SeedImportRequest(BaseModel):
    file_name: str = Field(default="saved-items.csv", max_length=240)
    csv_text: str = Field(min_length=1, max_length=5_000_000)


class KnowledgeQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_000)
    top_k: int = Field(default=3, ge=1, le=5)


class ThreadContext(BaseModel):
    reply_count: Optional[int] = Field(default=None, ge=0, le=100_000)
    top_comments: list[str] = Field(default_factory=list, max_length=3)
    captured_from_visible_card: bool = False

class SaveSyncItem(BaseModel):
    url: HttpUrl
    title: str = Field(default="", max_length=240)
    author: str = Field(default="", max_length=160)
    platform: str = Field(default="custom_url", max_length=40)
    content: str = Field(default="", max_length=12_000)
    thread_context: Optional[ThreadContext] = None


class SaveSyncRequest(BaseModel):
    """Candidate-authorized batch of public URLs and visible captured excerpts."""
    platforms: Optional[list[str]] = None
    urls: Optional[list[HttpUrl]] = None
    url: Optional[HttpUrl] = None
    items: Optional[list[SaveSyncItem]] = None
    automatic: bool = False
    trigger_type: str = Field(default="manual", max_length=24)


def _storage_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="knowledge_store_unavailable",
    )


@router.get("/brief")
async def get_omnisave_brief(
    role: Optional[str] = Query(default=None, max_length=160),
    company: Optional[str] = Query(default=None, max_length=160),
    skill: Optional[str] = Query(default=None, max_length=160),
    user_id: str = Depends(get_current_user),
):
    try:
        return {"success": True, "brief": await get_omnisave_brief_service().build(user_id, role=role, company=company, skill=skill)}
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise


@router.get("/agent/omnisave/library")
async def agent_search_omnisave_library(
    query: Optional[str] = Query(default=None, max_length=240),
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    """Read-only agent contract; it can search the requesting candidate's library only."""
    try:
        sources = await get_omnisave_service().list_user_saved_sources(user_id=user_id)
        needle = (query or "").strip().lower()
        if needle:
            sources = [source for source in sources if needle in " ".join([
                str(source.get("title") or ""), str(source.get("author") or ""),
                str(source.get("primary_category") or ""), " ".join(source.get("secondary_tags") or []),
            ]).lower()]
        return {"success": True, "read_only": True, "query": query, "sources": sources[:limit]}
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise


@router.get("/agent/omnisave/brief")
async def agent_get_omnisave_brief(
    role: Optional[str] = Query(default=None, max_length=160),
    company: Optional[str] = Query(default=None, max_length=160),
    skill: Optional[str] = Query(default=None, max_length=160),
    user_id: str = Depends(get_current_user),
):
    """Read-only agent contract for candidate-authorized career preparation."""
    try:
        return {"success": True, "read_only": True, "brief": await get_omnisave_brief_service().build(user_id, role=role, company=company, skill=skill)}
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise


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


@router.post("/saves/import/seed", status_code=status.HTTP_201_CREATED)
async def create_seed_import(
    payload: SeedImportRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        job = await get_omnisave_seed_store().create_job(user_id, payload.file_name, payload.csv_text)
        return {"success": True, "job": job}
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/saves/import/jobs")
async def list_seed_imports(
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    try:
        return {"success": True, "jobs": await get_omnisave_seed_store().list_jobs(user_id, limit)}
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise


@router.get("/saves/import/jobs/{job_id}")
async def get_seed_import(job_id: str, user_id: str = Depends(get_current_user)):
    try:
        return {"success": True, "job": await get_omnisave_seed_store().get_job(user_id, job_id)}
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="seed_job_not_found") from exc
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise


@router.post("/saves/import/jobs/{job_id}/hydrate")
async def hydrate_seed_import(
    job_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    try:
        return {"success": True, "job": await get_omnisave_seed_store().hydrate(user_id, job_id, limit)}
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="seed_job_not_found") from exc
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise


@router.post("/saves/sync")
async def sync_agent_reach_saves(
    payload: SaveSyncRequest,
    user_id: str = Depends(get_current_user),
):
    """Compatibility endpoint for an explicit batch of candidate-selected URLs."""
    # ponytail: normalize every candidate URL (strip fragments, validate scheme)
    # before dedup so identical posts shared with different URL forms do not
    # become duplicate sources with distinct idempotency hashes.
    requested_urls = [normalised for url in (payload.urls or []) if (normalised := _normalise_url(str(url)))]
    if payload.url:
        if normalised := _normalise_url(str(payload.url)):
            requested_urls.append(normalised)
    captured_items = []
    for item in (payload.items or []):
        item_data = item.model_dump()
        item_url = _normalise_url(str(item_data.get("url") or ""))
        if item_url:
            item_data["url"] = item_url
            captured_items.append(item_data)
    captured_urls = {str(item.get("url")) for item in captured_items if item.get("url")}
    requested_count = len(captured_urls | set(requested_urls))
    try:
        sync_store = get_omnisave_sync_store()
        trigger_type = payload.trigger_type if payload.trigger_type in {"manual", "automatic", "extension", "import"} else "manual"
        run_id = await sync_store.start_run(user_id, trigger_type, requested_count)
        try:
            result = await get_omnisave_service().sync_agent_reach_posts(
                user_id=user_id,
                platforms=payload.platforms,
                target_urls=requested_urls,
                source_items=captured_items,
            )
        except Exception as exc:  # noqa: BLE001
            await sync_store.finish_run(
                user_id,
                run_id,
                status="failed",
                imported_count=0,
                skipped_count=0,
                failed_count=requested_count,
                errors=[{"error": str(exc)[:500]}],
            )
            raise
        imported_count = int(result.get("count", 0) or 0)
        errors = result.get("errors", []) or []
        failed_count = len(errors)
        skipped_count = max(0, requested_count - imported_count - failed_count)
        await sync_store.finish_run(
            user_id,
            run_id,
            status="completed" if not errors else ("partial" if imported_count else "failed"),
            imported_count=imported_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            errors=errors,
        )
        result["run_id"] = run_id
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
        return {
            "query": result.get("query", payload.query),
            "answer": result.get("answer", ""),
            "citations": citations,
            "retrieved_count": result.get("retrieved_count", len(citations)),
            "has_evidence": result.get("has_evidence", bool(citations)),
        }
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


class HighlightCreateRequest(BaseModel):
    text_excerpt: str = Field(min_length=1, max_length=5_000)
    start_offset: Optional[int] = Field(default=None, ge=0)
    end_offset: Optional[int] = Field(default=None, ge=0)
    note: str = Field(default="", max_length=2_000)
    color: str = Field(default="amber", min_length=1, max_length=24)
    action_type: str = Field(default="evidence", min_length=1, max_length=32)


class ContextLinkRequest(BaseModel):
    context_type: str = Field(min_length=1, max_length=32)
    context_id: Optional[str] = Field(default=None, max_length=128)
    context_label: str = Field(min_length=1, max_length=240)


def _evidence_error(exc: Exception) -> HTTPException:
    if isinstance(exc, RuntimeError) and str(exc) == "knowledge_store_unavailable":
        return _storage_unavailable()
    if isinstance(exc, LookupError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="source_not_found")
    if isinstance(exc, ValueError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    logger.error("OmniSaveAI evidence operation failed", exc_info=exc)
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="evidence_operation_failed")


@router.post("/saves/{source_id}/highlights", status_code=status.HTTP_201_CREATED)
async def create_source_highlight(
    source_id: str,
    payload: HighlightCreateRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        highlight = await get_omnisave_evidence_store().create_highlight(
            user_id,
            source_id,
            text_excerpt=payload.text_excerpt,
            note=payload.note,
            color=payload.color,
            action_type=payload.action_type,
            start_offset=payload.start_offset,
            end_offset=payload.end_offset,
        )
        return {"success": True, "highlight": highlight}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.get("/saves/{source_id}/highlights")
async def list_source_highlights(
    source_id: str,
    user_id: str = Depends(get_current_user),
):
    try:
        highlights = await get_omnisave_evidence_store().list_highlights(user_id, source_id)
        return {"success": True, "highlights": highlights}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.delete("/saves/{source_id}/highlights/{highlight_id}")
async def delete_source_highlight(
    source_id: str,
    highlight_id: str,
    user_id: str = Depends(get_current_user),
):
    try:
        deleted = await get_omnisave_evidence_store().delete_highlight(user_id, source_id, highlight_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="highlight_not_found")
        return {"success": True, "deleted": True, "highlight_id": highlight_id}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.post("/saves/{source_id}/context", status_code=status.HTTP_201_CREATED)
async def link_source_context(
    source_id: str,
    payload: ContextLinkRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        link = await get_omnisave_evidence_store().link_context(
            user_id,
            source_id,
            context_type=payload.context_type,
            context_id=payload.context_id,
            context_label=payload.context_label,
        )
        return {"success": True, "context": link}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.get("/saves/{source_id}/context")
async def list_source_context(
    source_id: str,
    user_id: str = Depends(get_current_user),
):
    try:
        context = await get_omnisave_evidence_store().list_context_links(user_id, source_id)
        return {"success": True, "context": context}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.get("/context/graph")
async def get_context_graph(
    skill: Optional[str] = Query(default=None, max_length=160),
    role: Optional[str] = Query(default=None, max_length=160),
    user_id: str = Depends(get_current_user),
):
    try:
        return await get_omnisave_evidence_store().context_graph(user_id, skill=skill, role=role)
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.get("/saves/sync/settings")
async def get_sync_settings(user_id: str = Depends(get_current_user)):
    try:
        return {"success": True, "settings": await get_omnisave_sync_store().get_settings(user_id)}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


class SyncSettingsRequest(BaseModel):
    enabled: bool = False
    platforms: Optional[list[str]] = None
    interval_minutes: int = Field(default=60, ge=5, le=1440)


@router.put("/saves/sync/settings")
async def update_sync_settings(
    payload: SyncSettingsRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        settings = await get_omnisave_sync_store().update_settings(
            user_id,
            enabled=payload.enabled,
            platforms=payload.platforms,
            interval_minutes=payload.interval_minutes,
        )
        return {"success": True, "settings": settings}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.get("/saves/sync/runs")
async def list_sync_runs(
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    try:
        return {"success": True, "runs": await get_omnisave_sync_store().list_runs(user_id, limit)}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc


@router.get("/saves/activity")
async def list_omnisave_activity(
    limit: int = Query(default=50, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    try:
        from app.services.db import get_pool
        import uuid as uuid_lib
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("knowledge_store_unavailable")
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT occurred_at, event_type, entity_id, label, detail
                FROM (
                    SELECT created_at AS occurred_at, 'capture' AS event_type, id AS entity_id, title AS label,
                           jsonb_build_object('platform', source_platform, 'capture_origin', COALESCE(p.capture_origin, 'unknown')) AS detail
                    FROM public.saved_sources
                    LEFT JOIN public.omnisave_source_provenance p ON p.source_id = saved_sources.id AND p.user_id = saved_sources.user_id
                    WHERE saved_sources.user_id = $1
                    UNION ALL
                    SELECT created_at, 'evidence_created', id, LEFT(text_excerpt, 160), jsonb_build_object('source_id', source_id, 'action_type', action_type)
                    FROM public.source_highlights WHERE user_id = $1
                    UNION ALL
                    SELECT created_at, 'context_linked', id, context_label, jsonb_build_object('source_id', source_id, 'context_type', context_type)
                    FROM public.source_context_links WHERE user_id = $1
                    UNION ALL
                    SELECT started_at, 'sync_run', id, trigger_type, jsonb_build_object('status', status, 'imported_count', imported_count, 'failed_count', failed_count)
                    FROM public.omnisave_sync_runs WHERE user_id = $1
                ) activity
                ORDER BY occurred_at DESC
                LIMIT $2
                """,
                uuid_lib.UUID(user_id),
                limit,
            )
        return {"success": True, "events": [
            {"occurred_at": row["occurred_at"].isoformat() if row["occurred_at"] else None, "event_type": row["event_type"], "entity_id": str(row["entity_id"]), "label": row["label"], "detail": row["detail"] or {}}
            for row in rows
        ]}
    except RuntimeError as exc:
        if str(exc) == "knowledge_store_unavailable":
            raise _storage_unavailable() from exc
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("OmniSaveAI activity listing failed")
        raise HTTPException(status_code=500, detail="activity_unavailable") from exc

@router.get("/saves/export")
async def export_saved_sources(user_id: str = Depends(get_current_user)):
    try:
        bundle = await get_omnisave_sync_store().export_bundle(user_id)
        return {"success": True, "bundle": bundle}
    except Exception as exc:  # noqa: BLE001
        raise _evidence_error(exc) from exc
