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
from app.services.communication import CommunicationGenerator
from app.services.interview_ai import InterviewPrepGenerator
from app.services.llm_service import LLMNotConfiguredError, interview_questions as _interview_questions_fn

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Interview & Communication"], dependencies=[Depends(get_current_user)])


class CommunicationRequest(BaseModel):
    comm_type: str
    resume_text: str
    job_title: str
    company_name: str
    recipient_name: Optional[str] = None
    discussion_points: Optional[list[str]] = None
    offer_details: Optional[dict] = None
    days_since: int = 3


@router.post("/api/v1/communication/generate")
async def communication_generate(payload: CommunicationRequest):
    """Generate AI communication (follow-up, thank-you, negotiation, status-check)."""
    try:
        result = await CommunicationGenerator.generate(
            comm_type=payload.comm_type,
            resume_text=payload.resume_text,
            job_title=payload.job_title,
            company_name=payload.company_name,
            recipient_name=payload.recipient_name,
            discussion_points=payload.discussion_points,
            offer_details=payload.offer_details,
            days_since=payload.days_since,
        )
        return result
    except Exception as exc:
        logger.error("communication/generate failed: %s", exc)
        raise HTTPException(status_code=502, detail="Communication generation failed") from exc


class InterviewPrepRequest(BaseModel):
    resume_text: str
    job_title: str
    company_name: Optional[str] = None
    job_description: Optional[str] = None
    interview_type: str = "behavioral"


@router.post("/api/v1/interview/prep")
async def interview_prep(payload: InterviewPrepRequest):
    """Generate resume-aware interview preparation materials."""
    try:
        result = await InterviewPrepGenerator.generate(
            resume_text=payload.resume_text,
            job_title=payload.job_title,
            company_name=payload.company_name,
            job_description=payload.job_description,
            interview_type=payload.interview_type,
        )
        return result
    except Exception as exc:
        logger.error("interview/prep failed: %s", exc)
        raise HTTPException(status_code=502, detail="Interview prep failed") from exc


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
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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


@router.post("/api/v1/offer/calculate")
async def offer_calculate_endpoint(payload: dict):
    """Calculate annualized NPV total compensation and COL-adjusted purchasing power."""
    from app.services.offer_calculator import JobOfferInput, calculate_offer_comp
    offer_input = JobOfferInput(**payload)
    res = calculate_offer_comp(offer_input)
    return res


@router.post("/api/v1/interview/copilot")
async def live_copilot_endpoint(payload: dict):
    """Generate instant bulleted STAR framework hints and metrics for live interviewer questions."""
    from app.services.live_interview_copilot import LiveCopilotRequest, generate_live_copilot_hints
    req = LiveCopilotRequest(**payload)
    try:
        return await generate_live_copilot_hints(req)
    except LLMNotConfiguredError as exc:
        logger.error("interview/copilot: LLM not configured: %s", exc)
        raise HTTPException(status_code=503, detail="ai_service_unavailable") from exc


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
