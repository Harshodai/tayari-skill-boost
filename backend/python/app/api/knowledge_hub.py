"""Knowledge Hub (Omni-Save) — Python AI layer.

Provides AI enrichment for saved posts (summarize, categorize, tag).
Persistence is handled by the Go backend; this service is stateless.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

from app.services.llm_service import summarize_saved_post
from app.services.omnisave_service import get_omnisave_service


router = APIRouter(prefix="/api/v1", tags=["knowledge-hub"])


class SaveAnalyzeRequest(BaseModel):
    url: str
    note: Optional[str] = ""
    source: Optional[str] = "other"


class KnowledgeQueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3


class SaveSyncRequest(BaseModel):
    platforms: Optional[list[str]] = ["substack", "medium", "linkedin"]


@router.get("/saves")
async def get_saved_sources(authorization: Optional[str] = Header(None)):
    """Fetch saved sources from Omnisave AI vector knowledge base. Requires valid Bearer token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    import jwt
    import os
    JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET")
    if not JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET or SUPABASE_JWT_SECRET not configured"
        )
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

    try:
        decoded = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_signature": True, "verify_exp": True}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decoded.get("sub")
    if not user_id or not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing or empty subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    service = get_omnisave_service()
    sources = service.get_user_saved_sources(user_id=user_id)
    return {"success": True, "sources": sources}


@router.post("/saves/sync")
async def sync_agent_reach_saves(payload: Optional[SaveSyncRequest] = None, authorization: Optional[str] = Header(None)):
    """Trigger Agent Reach & Hermes extraction engine to sync saved posts. Requires valid Bearer token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    import jwt
    import os
    JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET")
    if not JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET or SUPABASE_JWT_SECRET not configured"
        )
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

    try:
        decoded = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_signature": True, "verify_exp": True}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decoded.get("sub")
    if not user_id or not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing or empty subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    service = get_omnisave_service()
    platforms = payload.platforms if payload and payload.platforms else ["substack", "medium", "linkedin"]
    result = await service.sync_agent_reach_posts(user_id=user_id, platforms=platforms)
    return result


@router.post("/saves/analyze")
async def analyze_saved_post(payload: SaveAnalyzeRequest):
    """AI-enrich a saved URL: generate title, summary, tags, category."""
    if not payload.url or len(payload.url) < 5:
        raise HTTPException(status_code=422, detail="url is required")
    try:
        result = await summarize_saved_post(
            url=payload.url,
            note=payload.note or "",
            source=payload.source or "other",
        )
        return result
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI enrichment failed: {exc}") from exc


@router.post("/knowledge-hub/query")
async def query_knowledge_hub(
    payload: KnowledgeQueryRequest,
    authorization: Optional[str] = Header(None)
):
    """Query the Omnisave knowledge base using RAG. Requires valid Bearer token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    import jwt
    import os
    JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET")
    if not JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET or SUPABASE_JWT_SECRET not configured"
        )
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

    try:
        decoded = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_signature": True, "verify_exp": True}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decoded.get("sub")
    if not user_id or not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing or empty subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        omnisave = get_omnisave_service()
        result = await omnisave.query_knowledge_rag(
            query=payload.query,
            user_id=user_id,
            top_k=payload.top_k,
        )
        # Transform citations format to match frontend expectations
        citations = [
            {
                "tag": c.get("citation", f"[Source {i+1}]"),
                "title": c.get("title", "Saved Article"),
                "author": c.get("author", "Unknown"),
                "url": c.get("url", "#"),
            }
            for i, c in enumerate(result.get("citations", []))
        ]
        return {
            "answer": result.get("answer", ""),
            "citations": citations,
        }
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).error("Knowledge query failed", exc_info=exc)
        raise HTTPException(status_code=502, detail="Knowledge query failed") from exc