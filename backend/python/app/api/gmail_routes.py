"""Gmail AI service — Tayari Python layer.

Provides LLM-based email parsing for Gmail → Kanban sync.
The Go backend owns OAuth token storage + Gmail API calls;
this service receives raw email text and returns structured parse results.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.llm_service import parse_application_email

router = APIRouter(prefix="/api/v1", tags=["gmail"])


class ParseEmailRequest(BaseModel):
    email_text: str
    subject: Optional[str] = ""
    from_address: Optional[str] = ""


@router.post("/gmail/parse-email")
async def parse_email(payload: ParseEmailRequest):
    """Parse recruiter/application email text into structured Kanban data."""
    if not payload.email_text or len(payload.email_text.strip()) < 10:
        raise HTTPException(status_code=422, detail="email_text is required")

    full_text = ""
    if payload.subject:
        full_text += f"Subject: {payload.subject}\nFrom: {payload.from_address}\n\n"
    full_text += payload.email_text

    try:
        result = await parse_application_email(full_text)
        return result
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI email parse failed: {exc}") from exc
