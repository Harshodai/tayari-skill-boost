"""
AI Engine core API routes for strategic analysis, optimizer, exports, cover letters, and copilot.
"""
import asyncio
import json
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse, Response
from pydantic import BaseModel

from app.schemas import (
    StrategicAnalysisResponse,
    EntitiesResponse,
    AIProofingAnalysis,
    ExportRequest,
    CoverLetterInput,
    CommunicationInput,
    InterviewPrepInput,
    KnowledgeGraphInput,
)
from app.parsers.document_parser import ResumeParser
from app.extraction.entity_extractor import EntityExtractor, KeywordInjector
from app.ai_proofing.detector import AIProofingDetector
from app.llm.strategic_analyzer import StrategicAnalyzer
from app.export.pdf_exporter import PDFExporter
from app.export.json_exporter import JSONExporter
from app.services import ats_engine, optimizer, job_agent, docx_builder, automation_engine
from app.services.llm_service import LLMNotConfiguredError
from app.services.cover_letter import CoverLetterGenerator
from app.services.communication import CommunicationGenerator
from app.services.interview_ai import InterviewPrepGenerator
from app.services.knowledge_graph import KnowledgeGraphExtractor
from app.services.linkedin_analyzer import score_linkedin_profile
from app.services.offer_calculator import JobOfferInput, calculate_offer_comp
from app.services.live_interview_copilot import LiveCopilotRequest, generate_live_copilot_hints

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai"])

entity_extractor = EntityExtractor()
ai_proofing = AIProofingDetector()
strategic_analyzer = StrategicAnalyzer()


class AnalyzeRequest(BaseModel):
    resume_text: Optional[str] = None
    job_description: Optional[str] = None


class StrategicInjectRequest(BaseModel):
    experience_bullets: List[str]
    missing_keywords: List[str]


class OptimizerRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None


@router.post("/api/v1/strategic/analyze", response_model=None)
async def strategic_analyze(payload: AnalyzeRequest):
    """Strategic LLM analysis (hidden skills, templates, recommendations)."""
    try:
        return await strategic_analyzer.analyze(
            payload.resume_text or "", payload.job_description or ""
        )
    except LLMNotConfiguredError as exc:
        logger.error("strategic/analyze: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except Exception as exc:
        logger.error("strategic/analyze failed: %s", exc)
        raise HTTPException(status_code=502, detail="Strategic analysis failed") from exc


@router.post("/api/v1/strategic/entities", response_model=EntitiesResponse)
async def strategic_entities(payload: AnalyzeRequest):
    """Extract entities from resume or JD."""
    try:
        text = payload.resume_text or payload.job_description or ""
        return entity_extractor.extract(text)
    except Exception as exc:
        logger.error("strategic/entities failed: %s", exc)
        raise HTTPException(status_code=502, detail="Entity extraction failed") from exc


@router.post("/api/v1/strategic/inject")
async def strategic_inject(payload: StrategicInjectRequest):
    """Suggest keyword injection points."""
    try:
        injector = KeywordInjector()
        return injector.suggest_injections(payload.experience_bullets, payload.missing_keywords)
    except Exception as exc:
        logger.error("strategic/inject failed: %s", exc)
        raise HTTPException(status_code=502, detail="Keyword injection failed") from exc


@router.post("/api/v1/strategic/ai-proof", response_model=AIProofingAnalysis)
async def ai_proof(payload: AnalyzeRequest):
    """Analyze resume for AI-detection risks."""
    try:
        return ai_proofing.analyze(payload.resume_text or "")
    except Exception as exc:
        logger.error("strategic/ai-proof failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI proofing failed") from exc


@router.post("/api/v1/export/json")
async def export_json(payload: ExportRequest):
    """Export resume as JSON."""
    try:
        data = JSONExporter.export(payload.resume_json)
        return {"data": data.decode("utf-8")}
    except Exception as exc:
        logger.error("export/json failed: %s", exc)
        raise HTTPException(status_code=500, detail="JSON export failed") from exc


@router.post("/api/v1/export/pdf")
async def export_pdf(payload: ExportRequest):
    """Export resume as PDF (ATS-safe)."""
    try:
        pdf_bytes = await asyncio.to_thread(PDFExporter.export, payload.resume_json)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=resume.pdf"},
        )
    except Exception as exc:
        logger.error("export/pdf failed: %s", exc)
        raise HTTPException(status_code=500, detail="PDF export failed") from exc


@router.post("/api/v1/optimizer/optimize")
async def optimize_resume(payload: OptimizerRequest):
    """AI-powered resume optimization with reflexion loop."""
    try:
        result = await optimizer.optimize_with_reflection(
            payload.resume_text,
            job_description=payload.job_description,
        )
        return result
    except LLMNotConfiguredError as exc:
        logger.error("optimizer/optimize: LLM not configured/available: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except Exception as exc:
        logger.error("optimizer/optimize failed: %s", exc)
        raise HTTPException(status_code=502, detail="Optimization failed") from exc


@router.post("/api/v1/optimize/stream")
async def optimize_resume_stream(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    target_role: Optional[str] = Form(None),
):
    """Stream resume optimization results as Server-Sent Events."""
    if resume_file:
        data = await resume_file.read()
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File size exceeds maximum allowed limit of 10MB")
        parsed = await asyncio.to_thread(ResumeParser.parse_file, data, resume_file.filename or "resume.pdf")
        resume_text = parsed.raw_text or ""
    elif not resume_text:
        raise HTTPException(400, "Provide resume_text or resume_file")
    
    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Analyzing resume...'})}\n\n"
            result = await optimizer.optimize_with_reflection(
                resume_text,
                job_description=job_description,
                target_role=target_role,
            )
            yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except LLMNotConfiguredError as exc:
            logger.error("optimize_resume_stream: LLM not configured: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'error': 'ai_service_unavailable', 'message': 'AI service unavailable'})}\n\n"
        except Exception as exc:
            logger.error("optimize_resume_stream generator failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Optimization failed due to an internal error'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/api/v1/cover-letter/generate")
async def generate_cover_letter_endpoint(payload: CoverLetterInput):
    """Generate tailored cover letter matching candidate experience."""
    try:
        return await CoverLetterGenerator.generate(
            resume_text=payload.resume_text,
            job_description=payload.job_description,
            company_name=payload.company_name,
            job_title=payload.job_title,
            tone=payload.tone,
            personal_notes=payload.personal_notes,
        )
    except LLMNotConfiguredError as exc:
        logger.error("cover-letter/generate: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})


@router.post("/api/v1/communication/generate")
async def generate_communication_endpoint(payload: CommunicationInput):
    """Generate follow-up, thank-you, status check, or negotiation emails with Voice DNA."""
    try:
        return await CommunicationGenerator.generate(
            comm_type=payload.comm_type,
            resume_text=payload.resume_text,
            job_title=payload.job_title,
            company_name=payload.company_name,
            recipient_name=payload.recipient_name,
            discussion_points=payload.discussion_points,
            offer_details=payload.offer_details,
            days_since=payload.days_since,
        )
    except LLMNotConfiguredError as exc:
        logger.error("communication/generate: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})


@router.post("/api/v1/interview/prep")
async def generate_interview_prep_endpoint(payload: InterviewPrepInput):
    """Generate STAR & technical interview questions based on experience."""
    try:
        return await InterviewPrepGenerator.generate(
            resume_text=payload.resume_text,
            job_title=payload.job_title,
            company_name=payload.company_name,
            interview_type=payload.interview_type,
        )
    except LLMNotConfiguredError as exc:
        logger.error("interview/prep: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})


@router.post("/api/v1/resume/knowledge-graph")
async def extract_knowledge_graph_endpoint(payload: KnowledgeGraphInput):
    """Extract candidate skills, achievements, timeline knowledge graph."""
    try:
        return await KnowledgeGraphExtractor.extract(payload.resume_text)
    except LLMNotConfiguredError as exc:
        logger.error("resume/knowledge-graph: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})


@router.post("/api/v1/candidate-bank/match")
async def match_candidate_bank_endpoint(payload: dict):
    """Match ATS form label against candidate answer bank."""
    from app.services.candidate_answer_bank import match_question_to_answer, CandidateAnswers
    question = payload.get("question_text", "")
    custom_qa = payload.get("custom_qa", {})
    bank = CandidateAnswers(custom_qa=custom_qa)
    return match_question_to_answer(question, bank)


@router.post("/api/v1/ats/detect")
async def detect_ats_endpoint(payload: dict):
    """Detect ATS vendor from URL or HTML snippet."""
    from app.services.ats_detector import detect_ats_from_url
    url = payload.get("url", "")
    html_snippet = payload.get("html_snippet", "")
    return detect_ats_from_url(url, html_snippet)


@router.post("/api/v1/guardrails/truth-check")
async def truth_check_endpoint(payload: dict):
    """Verify resume truthfulness to flag hallucinated titles or metrics."""
    from app.guardrails.truth_gate import verify_resume_truthfulness
    orig = payload.get("original_text", "")
    opt = payload.get("optimized_text", "")
    return verify_resume_truthfulness(orig, opt).model_dump()


@router.post("/api/v1/recruiter/lookup")
async def recruiter_lookup_endpoint(payload: dict):
    """Generate recruiter intelligence and outreach templates."""
    from app.services.recruiter_intelligence import generate_recruiter_intelligence
    company = payload.get("company_name", "Target Company")
    title = payload.get("job_title", "Software Engineer")
    manager = payload.get("hiring_manager_name")
    user = payload.get("user_name", "Candidate")
    skills = payload.get("user_skills", [])
    return generate_recruiter_intelligence(company, title, manager, user, skills)


@router.post("/api/v1/offer/calculate")
async def offer_calculate_endpoint(payload: JobOfferInput):
    """Calculate total compensation and cost-of-living purchasing power."""
    return calculate_offer_comp(payload).model_dump()


@router.post("/api/v1/interview/copilot")
async def live_copilot_endpoint(payload: LiveCopilotRequest):
    """Generate instant live interview hints."""
    try:
        return await generate_live_copilot_hints(payload)
    except LLMNotConfiguredError as exc:
        logger.error("interview/copilot: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})


@router.post("/api/v1/one-shot/execute")
async def execute_one_shot_endpoint(payload: dict):
    """Execute complete 6-stage one-shot application pipeline."""
    from app.services.one_shot_engine import OneShotRequest, execute_one_shot_pipeline
    try:
        req = OneShotRequest(**payload)
        res = await execute_one_shot_pipeline(req)
        return res
    except LLMNotConfiguredError as exc:
        logger.error("one-shot/execute: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except Exception as exc:
        logger.error("one-shot/execute failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
