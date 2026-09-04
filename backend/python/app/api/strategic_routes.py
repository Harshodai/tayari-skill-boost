"""
Strategic analysis and entity routes for the Tayari AI Engine.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.schemas import (
    StrategicAnalysisResponse,
    EntitiesResponse,
    AIProofingAnalysis,
)
from app.routes.ats import AnalyzeRequest
from app.auth.dependencies import get_current_user
from app.extraction.entity_extractor import EntityExtractor, KeywordInjector
from app.ai_proofing.detector import AIProofingDetector
from app.llm.strategic_analyzer import StrategicAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Strategic"])

entity_extractor = EntityExtractor()
ai_proofing = AIProofingDetector()
strategic_analyzer = StrategicAnalyzer()


class StrategicInjectRequest(BaseModel):
    experience_bullets: list[str]
    missing_keywords: list[str]


@router.post("/api/v1/strategic/analyze", response_model=StrategicAnalysisResponse)
async def strategic_analyze(
    payload: AnalyzeRequest,
    _user_id: str = Depends(get_current_user),
):
    """Strategic LLM analysis (hidden skills, templates, recommendations)."""
    try:
        return await strategic_analyzer.analyze(
            payload.resume_text or "", payload.job_description or ""
        )
    except Exception as exc:
        logger.error("strategic/analyze failed: %s", exc)
        raise HTTPException(status_code=502, detail="Strategic analysis failed") from exc


@router.post("/api/v1/strategic/entities", response_model=EntitiesResponse)
async def strategic_entities(
    payload: AnalyzeRequest,
    _user_id: str = Depends(get_current_user),
):
    """Extract entities from resume or JD."""
    try:
        text = payload.resume_text or payload.job_description or ""
        return entity_extractor.extract(text)
    except Exception as exc:
        logger.error("strategic/entities failed: %s", exc)
        raise HTTPException(status_code=502, detail="Entity extraction failed") from exc


@router.post("/api/v1/strategic/inject")
async def strategic_inject(
    payload: StrategicInjectRequest,
    _user_id: str = Depends(get_current_user),
):
    """Suggest keyword injection points."""
    try:
        injector = KeywordInjector()
        return injector.suggest_injections(payload.experience_bullets, payload.missing_keywords)
    except Exception as exc:
        logger.error("strategic/inject failed: %s", exc)
        raise HTTPException(status_code=502, detail="Keyword injection failed") from exc


@router.post("/api/v1/strategic/ai-proof", response_model=AIProofingAnalysis)
async def ai_proof(
    payload: AnalyzeRequest,
    _user_id: str = Depends(get_current_user),
):
    """Analyze resume for AI-detection risks."""
    try:
        return ai_proofing.analyze(payload.resume_text or "")
    except Exception as exc:
        logger.error("strategic/ai-proof failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI proofing failed") from exc
