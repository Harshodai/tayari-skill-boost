"""Knowledge Hub (Omni-Save) — Python AI layer.

Provides AI enrichment for saved posts (summarize, categorize, tag).
Persistence is handled by the Go backend; this service is stateless.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.llm_service import summarize_saved_post

router = APIRouter(prefix="/api/v1", tags=["knowledge-hub"])


class SaveAnalyzeRequest(BaseModel):
    url: str
    note: Optional[str] = ""
    source: Optional[str] = "other"


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
