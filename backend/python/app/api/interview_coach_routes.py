"""
Interview prep, live copilot, communication, negotiation, and voice coach routes.
"""
import json as _json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.services.llm_service import interview_questions as _interview_questions_fn

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Interview & Communication"], dependencies=[Depends(get_current_user)])

# ponytail: this file used to also define communication_generate,
# interview_prep, offer_calculate_endpoint, and live_copilot_endpoint at
# /communication/generate, /interview/prep, /offer/calculate, and
# /interview/copilot — all four collided with duplicate registrations in
# ai_routes.py, which is include_router'd first in main.py, so all four were
# dead code here (found by the Python route-collision test). interview_prep's
# dead version actually had the one real bug: its InterviewPrepRequest had a
# job_description field that ai_routes.py's live InterviewPrepInput schema
# was missing entirely (fixed directly in schemas.py + ai_routes.py instead
# of reviving this copy). Removed all four; /interview/copilot/stream,
# /negotiation/generate, and /applications/interview-questions below are
# real, non-colliding routes and stay.


class InterviewQuestionsRequest(BaseModel):
    profile_summary: Optional[str] = ""
    application: dict = {}
    jd: Optional[str] = ""


@router.post("/api/v1/applications/interview-questions")
@router.post("/api/applications/interview-questions")
async def generate_interview_questions(payload: InterviewQuestionsRequest):
    """Generate per-application interview intel (commonly asked questions, prep focus)."""
    try:
        result = await _interview_questions_fn(
            payload.profile_summary or "",
            payload.application,
            payload.jd or "",
        )
        return result
    except Exception as exc:
        logger.error("applications/interview-questions failed: %s", exc)
        raise HTTPException(status_code=502, detail="Interview questions generation failed") from exc


class VoiceFeedbackRequest(BaseModel):
    transcript: str
    duration_seconds: Optional[float] = 30.0
    target_role: Optional[str] = "Software Engineer"


def process_voice_feedback(payload: VoiceFeedbackRequest):
    """Analyze real-time audio response transcript for WPM, fillers, and STAR score."""
    from app.services.voice_coach import analyze_transcript_metrics
    try:
        return analyze_transcript_metrics(
            payload.transcript,
            duration_seconds=payload.duration_seconds or 30.0,
            target_role=payload.target_role or "Software Engineer",
        )
    except Exception as exc:
        logger.error("voice feedback failed: %s", exc)
        raise HTTPException(status_code=500, detail="Voice feedback analysis failed") from exc


class NegotiationRequest(BaseModel):
    role: str
    company: str
    base_offer: float
    equity_offer: Optional[float] = 0.0
    signon_offer: Optional[float] = 0.0
    competing_offer: Optional[float] = 0.0
    location: Optional[str] = "San Francisco, CA"


@router.post("/api/v1/negotiation/generate")
@router.post("/api/negotiation/generate")
async def negotiation_endpoint(payload: NegotiationRequest):
    """Generate salary benchmark data and 3-stage negotiation emails/script."""
    from app.services.negotiation_copilot import generate_negotiation_strategy
    try:
        return await generate_negotiation_strategy(
            role=payload.role,
            company=payload.company,
            base_offer=payload.base_offer,
            equity_offer=payload.equity_offer or 0.0,
            signon_offer=payload.signon_offer or 0.0,
            competing_offer=payload.competing_offer or 0.0,
            location=payload.location or "San Francisco, CA",
        )
    except Exception as exc:
        logger.error("negotiation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Negotiation strategy generation failed.") from exc


@router.post("/api/v1/interview/copilot/stream")
async def live_copilot_stream_endpoint(payload: dict):
    """SSE stream of progressive STAR hints for live interviewer questions."""
    from app.services.live_interview_copilot import LiveCopilotRequest, stream_live_copilot_hints

    req = LiveCopilotRequest(**payload)

    async def event_stream():
        async for event in stream_live_copilot_hints(req):
            yield f"data: {_json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
