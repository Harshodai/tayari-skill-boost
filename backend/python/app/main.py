"""
Tayari AI Engine — FastAPI entry point.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.schemas import (
    ATSAnalysisResponse,
    QuickScoreResponse,
    EntitiesResponse,
    StrategicAnalysisResponse,
    AIProofingAnalysis,
    ExportRequest,
    ExportResponse,
)
from app.parsers.document_parser import ResumeParser, ParsedResume
from app.analysis.similarity import KeywordAnalyzer
from app.analysis.ngram_analyzer import NGramAnalyzer
from app.scoring.ats_scorer import ATSScorer
from app.extraction.entity_extractor import EntityExtractor, KeywordInjector
from app.ai_proofing.detector import AIProofingDetector
from app.llm.strategic_analyzer import StrategicAnalyzer
from app.export.pdf_exporter import PDFExporter
from app.export.json_exporter import JSONExporter
from app.services import ats_engine, optimizer, job_agent, docx_builder, automation_engine
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_dsn = os.getenv("SENTRY_DSN", "")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.2,
    )

from app.services.circuit_breaker import circuit_breaker
from app.guardrails import PipelineGate
from app.telemetry import stage_complete, stage_fail
from app.services.llm_service import active_engine, llm_complete
from app.services.cover_letter import CoverLetterGenerator
from app.services.communication import CommunicationGenerator
from app.services.interview_ai import InterviewPrepGenerator
from app.services.knowledge_graph import KnowledgeGraphExtractor

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — start/stop the Auto-Pilot scheduler as a background task
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the recurring Auto-Pilot scheduler on startup, cancel on shutdown."""
    from app.services.scheduler import (
        scheduler_loop,
        _load_profile_for_user,
        _load_resume_for_user,
    )
    sched_task = asyncio.create_task(
        scheduler_loop(
            profile_provider=_load_profile_for_user,
            resume_provider=_load_resume_for_user,
        )
    )
    app.state.sched_task = sched_task
    logger.info("Auto-Pilot scheduler started")
    try:
        yield
    finally:
        sched_task.cancel()
        try:
            await sched_task
        except asyncio.CancelledError:
            pass
        logger.info("scheduler stopped")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Tayari AI Engine",
    version="1.0.0",
    description="Python AI Engine for the Tayari Resume Optimizer",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services (singletons)
keyword_analyzer = KeywordAnalyzer()
ngram_analyzer = NGramAnalyzer()
ats_scorer = ATSScorer()
entity_extractor = EntityExtractor()
ai_proofing = AIProofingDetector()
strategic_analyzer = StrategicAnalyzer()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_status: str


@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="ok",
        service="python-ai-engine",
        version="1.0.0",
        model_status="loaded" if active_engine() != "mock-fallback" else "llm_not_configured",
    )


# ---------------------------------------------------------------------------
# ATS Core Routes
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    resume_text: Optional[str] = None
    job_description: Optional[str] = None


@app.post("/api/v1/ats/analyze", response_model=ATSAnalysisResponse)
async def ats_analyze(
    resume_text: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    resume_file: Optional[UploadFile] = File(None),
    jd_file: Optional[UploadFile] = File(None),
):
    """Full ATS analysis: parse (if files), score, and recommend."""
    # --- ingest resume ---
    resume_parsed: Optional[ParsedResume] = None
    if resume_file:
        data = await resume_file.read()
        resume_parsed = ResumeParser.parse_file(data, resume_file.content_type or "pdf")
        resume_text = resume_parsed.raw_text or ""
    elif not resume_text:
        raise HTTPException(status_code=400, detail="Provide resume_text or resume_file")

    # --- ingest JD ---
    if jd_file:
        data = await jd_file.read()
        jd_text = data.decode("utf-8", errors="ignore")
    elif not job_description:
        raise HTTPException(status_code=400, detail="Provide job_description or jd_file")
    else:
        jd_text = job_description

    # --- run pipeline ---
    keywords = keyword_analyzer.analyze(resume_text, jd_text)
    ngrams = ngram_analyzer.analyze(resume_text, jd_text)
    result = ats_scorer.score(keywords, ngrams, resume_parsed, resume_text)
    return result


@app.post("/api/v1/ats/score", response_model=QuickScoreResponse)
async def ats_score(payload: AnalyzeRequest):
    """Quick score with minimal metadata."""
    keywords = keyword_analyzer.analyze(payload.resume_text or "", payload.job_description or "")
    total = keywords.total_jd_keywords or 1
    return QuickScoreResponse(
        score=round((keywords.matched_count / total) * 100),
        matched_keywords=keywords.matched_count,
        missing_keywords=len(keywords.missing),
        summary=f"Matched {keywords.matched_count}/{total} keywords",
    )


@app.post("/api/v1/ats/keywords")
async def ats_keywords(payload: AnalyzeRequest):
    """Extract and compare keywords."""
    keywords = keyword_analyzer.analyze(
        payload.resume_text or "", payload.job_description or ""
    )
    return keywords


# ---------------------------------------------------------------------------
# Strategic / Entity Routes
# ---------------------------------------------------------------------------

@app.post("/api/v1/strategic/analyze", response_model=StrategicAnalysisResponse)
async def strategic_analyze(payload: AnalyzeRequest):
    """Strategic LLM analysis (hidden skills, templates, recommendations)."""
    try:
        return await strategic_analyzer.analyze(
            payload.resume_text or "", payload.job_description or ""
        )
    except Exception as exc:
        logger.error("strategic/analyze failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Strategic analysis failed: {exc}") from exc


@app.post("/api/v1/strategic/entities", response_model=EntitiesResponse)
async def strategic_entities(payload: AnalyzeRequest):
    """Extract entities from resume or JD."""
    try:
        text = payload.resume_text or payload.job_description or ""
        return entity_extractor.extract(text)
    except Exception as exc:
        logger.error("strategic/entities failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Entity extraction failed: {exc}") from exc


class StrategicInjectRequest(BaseModel):
    experience_bullets: list[str]
    missing_keywords: list[str]


@app.post("/api/v1/strategic/inject")
async def strategic_inject(payload: StrategicInjectRequest):
    """Suggest keyword injection points."""
    try:
        injector = KeywordInjector()
        return injector.suggest_injections(payload.experience_bullets, payload.missing_keywords)
    except Exception as exc:
        logger.error("strategic/inject failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Keyword injection failed: {exc}") from exc


@app.post("/api/v1/strategic/ai-proof", response_model=AIProofingAnalysis)
async def ai_proof(payload: AnalyzeRequest):
    """Analyze resume for AI-detection risks."""
    try:
        return ai_proofing.analyze(payload.resume_text or "")
    except Exception as exc:
        logger.error("strategic/ai-proof failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI proofing failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Export Routes
# ---------------------------------------------------------------------------

@app.post("/api/v1/export/json")
async def export_json(payload: ExportRequest):
    """Export resume as JSON."""
    try:
        data = JSONExporter.export(payload.resume_json)
        return {"data": data.decode("utf-8")}
    except Exception as exc:
        logger.error("export/json failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"JSON export failed: {exc}") from exc


@app.post("/api/v1/export/pdf")
async def export_pdf(payload: ExportRequest):
    """Export resume as PDF (ATS-safe)."""
    try:
        pdf_bytes = PDFExporter.export(payload.resume_json)
        return {"size": len(pdf_bytes), "status": "generated"}
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# NEW: Optimizer, Deep ATS, Job Search, Auto-Pilot, DOCX Export
# ---------------------------------------------------------------------------

class OptimizerRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None


@app.post("/api/v1/optimizer/optimize")
async def optimize_resume(payload: OptimizerRequest):
    """AI-powered resume optimization with reflexion loop."""
    try:
        result = await optimizer.optimize_with_reflection(
            payload.resume_text,
            job_description=payload.job_description,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Optimization failed: {exc}") from exc


class DeepATSRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None


@app.post("/api/v1/ats/deep")
async def ats_deep(payload: DeepATSRequest):
    """Deep deterministic ATS analysis with heuristic checks."""
    return ats_engine.heuristic_ats_score(payload.resume_text, payload.job_description)


class JobSearchRequest(BaseModel):
    query: Optional[str] = None
    location: str = ""
    profile: Optional[dict] = None
    resume_text: Optional[str] = None
    top_n: int = 12
    scrape_enrich: bool = True
    target_board: Optional[dict] = None


@app.post("/api/v1/jobs/search")
async def jobs_search(payload: JobSearchRequest):
    """Smart job search with agentic pipeline (PLAN→GATHER→PRERANK→RANK→REPORT).

    Optional ``scrape_enrich`` (default True) runs the Hermes tiered scraper
    against ``target_board`` and merges the results with the free providers
    before ranking. Both default safely so existing callers are unaffected.
    """
    try:
        result = await job_agent.smart_search(
            payload.query,
            payload.location,
            payload.profile,
            payload.resume_text,
            top_n=payload.top_n,
            scrape_enrich=payload.scrape_enrich,
            target_board=payload.target_board,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Job search failed: {exc}") from exc


class AutopilotRunRequest(BaseModel):
    run_config: dict
    profile: Optional[dict] = None
    resume_text: str = ""
    candidate_name: str = "Candidate"


@app.post("/api/v1/autopilot/run")
async def autopilot_run(payload: AutopilotRunRequest):
    """Start an Auto-Pilot background run. Returns run_id immediately."""
    import asyncio
    run_id = str(__import__("uuid").uuid4())
    asyncio.create_task(
        automation_engine.run_autopilot(
            run_id,
            payload.run_config,
            payload.profile,
            payload.resume_text,
            payload.candidate_name,
        )
    )
    return {"run_id": run_id, "status": "queued"}


@app.get("/api/v1/autopilot/status/{run_id}")
async def autopilot_status(run_id: str):
    """Poll Auto-Pilot run status."""
    status = automation_engine.get_run_status(run_id)
    if not status:
        raise HTTPException(status_code=404, detail="Run not found")
    return status


@app.get("/api/v1/autopilot/applications/{run_id}")
async def autopilot_applications(run_id: str):
    """Get applications generated by an Auto-Pilot run."""
    apps = automation_engine.get_applications(run_id)
    return {"applications": apps}


class DocxExportRequest(BaseModel):
    text: str
    title: Optional[str] = "Resume"


@app.post("/api/v1/export/docx")
async def export_docx(payload: DocxExportRequest):
    """Export resume as ATS-safe DOCX."""
    try:
        buf = docx_builder.build_resume_docx(payload.text, payload.title)
        import base64
        return {"data": base64.b64encode(buf.getvalue()).decode("utf-8")}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DOCX export failed: {exc}") from exc


class CoverLetterRequest(BaseModel):
    resume_text: str
    job_title: str
    company: str
    job_description: str
    tone: Optional[str] = "formal"


@app.post("/api/v1/cover-letter/generate")
async def cover_letter_generate(payload: CoverLetterRequest):
    """Generate a structured, resume-aware, culture-matched cover letter."""
    try:
        result = await CoverLetterGenerator.generate(
            payload.resume_text,
            payload.job_description,
            payload.company,
            payload.job_title,
            tone=payload.tone or "formal",
        )
        return result
    except Exception as exc:
        logger.error("cover-letter/generate failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Cover letter generation failed: {exc}") from exc


class CommunicationRequest(BaseModel):
    comm_type: str
    resume_text: str
    job_title: str
    company_name: str
    recipient_name: Optional[str] = None
    discussion_points: Optional[list[str]] = None
    offer_details: Optional[dict] = None
    days_since: int = 3


@app.post("/api/v1/communication/generate")
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
        raise HTTPException(status_code=502, detail=f"Communication generation failed: {exc}") from exc


class InterviewPrepRequest(BaseModel):
    resume_text: str
    job_title: str
    company_name: Optional[str] = None
    job_description: Optional[str] = None
    interview_type: str = "behavioral"


@app.post("/api/v1/interview/prep")
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
        raise HTTPException(status_code=502, detail=f"Interview prep failed: {exc}") from exc


class KnowledgeGraphRequest(BaseModel):
    resume_text: str


@app.post("/api/v1/resume/knowledge-graph")
async def resume_knowledge_graph(payload: KnowledgeGraphRequest):
    """Extract structured knowledge graph from resume text."""
    try:
        result = await KnowledgeGraphExtractor.extract(payload.resume_text)
        return result
    except Exception as exc:
        logger.error("resume/knowledge-graph failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Knowledge graph extraction failed: {exc}") from exc


class ProfileImportRequest(BaseModel):
    resume_text: str


@app.post("/api/v1/profile/import-text")
async def profile_import_text(payload: ProfileImportRequest):
    """Import profile fields from resume text (parsed from PDF/DOCX)."""
    try:
        kg = await KnowledgeGraphExtractor.extract(payload.resume_text)
        entities = kg.get("entities", {})
        return {
            "headline": entities.get("job_titles", [None])[0] if entities.get("job_titles") else None,
            "summary": None,
            "skills": entities.get("skills", []),
            "experience_years": None,
            "desired_roles": entities.get("job_titles", []),
            "locations": [],
            "companies": entities.get("companies", []),
            "job_titles": entities.get("job_titles", []),
            "certifications": entities.get("certifications", []),
        }
    except Exception as exc:
        logger.error("profile/import-text failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Profile import failed: {exc}") from exc


class GuardrailsCheckRequest(BaseModel):
    resume_text: str


@app.post("/api/v1/guardrails/check")
async def guardrails_check(payload: GuardrailsCheckRequest):
    """Run guardrails on provided resume text."""
    gate = PipelineGate()
    return gate.check(optimized_text=payload.resume_text)


# ---------------------------------------------------------------------------
# Hermes agent layer (WS-E) — scrape, cached jobs, run status
# ---------------------------------------------------------------------------

from app.api.hermes_routes import hermes_router  # noqa: E402
from app.api.career_intelligence import router as career_intel_router  # noqa: E402
from app.api.voice_stream import router as voice_stream_router  # noqa: E402
from app.api.predictive import router as predictive_router  # noqa: E402
from app.api.knowledge_hub import router as knowledge_hub_router  # noqa: E402
from app.api.gmail_routes import router as gmail_ai_router  # noqa: E402
from app.api.agents_routes import router as agents_router  # noqa: E402
from app.api.career_ops_routes import router as career_ops_router  # noqa: E402

app.include_router(hermes_router)
app.include_router(career_intel_router)
app.include_router(voice_stream_router)
app.include_router(predictive_router)
app.include_router(knowledge_hub_router)
app.include_router(gmail_ai_router)
app.include_router(agents_router)
app.include_router(career_ops_router)




# ---------------------------------------------------------------------------
# Archive-ported endpoints (interview questions, voice transcription, email parse, agent-search)
# ---------------------------------------------------------------------------

import os  # noqa: E402  (already imported above, re-import safe)
import uuid  # noqa: E402
from fastapi import UploadFile, File as FastAPIFile  # noqa: E402

from app.services.llm_service import interview_questions as _interview_questions_fn  # noqa: E402
from app.services.transcribe import transcribe as _transcribe_fn  # noqa: E402
from app.services.llm_service import analyze_resume as _analyze_resume_fn  # noqa: E402

_VOICE_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "voice")
os.makedirs(_VOICE_UPLOAD_DIR, exist_ok=True)


class AnalyzeTextRequest(BaseModel):
    resume_text: str
    job_description: str
    custom_instructions: Optional[str] = ""


@app.post("/api/v1/resumes/analyze-text")
@app.post("/api/resumes/analyze-text")
async def analyze_text_endpoint(payload: AnalyzeTextRequest):
    """Analyze arbitrary resume text (used to score an optimized rewrite for before/after stats)."""
    try:
        result = await _analyze_resume_fn(
            payload.resume_text,
            payload.job_description,
            payload.custom_instructions or ""
        )
        return {"result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {exc}") from exc
class InterviewQuestionsRequest(BaseModel):
    profile_summary: Optional[str] = ""
    application: dict = {}
    jd: Optional[str] = ""


@app.post("/api/v1/applications/interview-questions")
@app.post("/api/applications/interview-questions")
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
        raise HTTPException(status_code=502, detail=f"Interview questions AI failed: {exc}") from exc


@app.post("/api/v1/voice/transcribe")
@app.post("/api/voice/transcribe")
async def transcribe_audio(
    audio: UploadFile = FastAPIFile(...),
):
    """Transcribe an uploaded audio file. Returns {transcript: str}."""
    content_type = audio.content_type or "audio/webm"
    fname = f"{uuid.uuid4().hex}.webm"
    fpath = os.path.join(_VOICE_UPLOAD_DIR, fname)
    data = await audio.read()
    with open(fpath, "wb") as f:
        f.write(data)
    transcript = await _transcribe_fn(fpath, content_type)
    return {"transcript": transcript, "file": fname}


class AgentSearchRequest(BaseModel):
    query: Optional[str] = None
    location: str = ""
    profile: Optional[dict] = None
    resume_text: Optional[str] = None
    top_n: int = 12


@app.post("/api/v1/jobs/agent-search")
@app.post("/api/jobs/agent-search")
async def agent_search(payload: AgentSearchRequest):
    """Agentic job search — wraps smart_search and emits an activity-log event list."""
    import asyncio as _asyncio
    from app.services import job_agent as _job_agent

    events: list[dict] = []

    def _emit(kind: str, msg: str, data: dict | None = None):
        events.append({"type": kind, "message": msg, "data": data or {}})

    _emit("start", "Agentic search initiated")
    try:
        result = await _job_agent.smart_search(
            payload.query,
            payload.location,
            payload.profile,
            payload.resume_text,
            top_n=payload.top_n,
            scrape_enrich=True,
        )
        _emit("complete", f"Found {len(result.get('jobs', []))} ranked matches")
        return {"events": events, "result": result}
    except Exception as exc:
        _emit("error", str(exc))
        raise HTTPException(status_code=502, detail=f"Agent search failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Plugin registration (backward compat)
# ---------------------------------------------------------------------------

from app.plugins import register_plugins  # noqa: E402


register_plugins(app)


if __name__ == "__main__":
    import uvicorn  # noqa: E402

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
