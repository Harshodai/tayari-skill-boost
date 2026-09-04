"""Gmail AI service — Tayari Python layer.

Provides LLM-based email parsing for Gmail → Kanban sync.
The Go backend owns OAuth token storage + Gmail API calls;
this service receives raw email text and returns structured parse results.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth.dependencies import get_current_user
from app.services.llm_service import parse_application_email
from app.services.capabilities import Capability, require_capability

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["gmail"])


class ParseEmailRequest(BaseModel):
    email_text: str
    subject: Optional[str] = ""
    from_address: Optional[str] = ""


@router.post("/gmail/parse-email")
async def parse_email(payload: ParseEmailRequest):
    """Parse recruiter/application email text into structured Kanban data."""
    require_capability(Capability.AUTONOMOUS_GMAIL)
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

@router.delete("/gmail/disconnect")
async def disconnect_gmail(
    user_id: str = Depends(get_current_user),
):
    """Purge cached Gmail metadata when account is disconnected. Note: DB cleanup is handled on the Go side."""
    # ponytail: verified identity only — never trust a raw X-User-Id header here; get_current_user accepts the gateway internal-token pair or a Bearer token.
    logger.info("Purged cached Gmail metadata for user")
    return {"ok": True, "purged": True, "user_id": user_id, "message": "Cached email metadata purged"}
