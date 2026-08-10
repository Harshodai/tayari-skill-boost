"""
Tayari AI Engine — FastAPI entry point.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

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
from app.export.json_exporter import JSONExporter
from app.services import ats_engine, optimizer, job_agent, docx_builder, automation_engine
try:
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
except ImportError:
    pass

from app.services.circuit_breaker import circuit_breaker
from app.guardrails import PipelineGate
from app.telemetry import stage_complete, stage_fail
from app.services.llm_service import active_engine, llm_complete, llm_json, LLMNotConfiguredError
from app.services.one_shot_engine import OneShotRequest
from app.services.cover_letter import CoverLetterGenerator
from app.services.communication import CommunicationGenerator
from app.services.interview_ai import InterviewPrepGenerator
from app.services.knowledge_graph import KnowledgeGraphExtractor
from app.services.linkedin_analyzer import score_linkedin_profile

logger = logging.getLogger(__name__)


from app.a2a.agents import register_all_a2a_agents
from app.api.a2a_routes import router as a2a_router
from app.routes.agent import router as agent_router


# ---------------------------------------------------------------------------
# Lifespan — start/stop the Auto-Pilot scheduler as a background task
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the recurring Auto-Pilot scheduler on startup, cancel on shutdown."""
    register_all_a2a_agents()
    logger.info("Registered all A2A agents")

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

app.include_router(a2a_router)
app.include_router(agent_router)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Read CORS origins from environment variable (comma-separated)
# Default includes common development origins only
_default_origins = [
    "http://localhost:8083",
    "http://127.0.0.1:8083",
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:4173",
]

_cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
if _cors_env:
    allowed_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    allowed_origins = _default_origins

# Production safety: validate no wildcard in production
_env = os.getenv("ENV", "development").lower()
if _env == "production":
    allowed_origins = [o for o in allowed_origins if o != "*"]
    if not allowed_origins:
        raise RuntimeError("CORS_ALLOWED_ORIGINS must be set in production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    max_age=600,
)

# Services (singletons)
keyword_analyzer = KeywordAnalyzer()
ngram_analyzer = NGramAnalyzer()
ats_scorer = ATSScorer()
entity_extractor = EntityExtractor()
ai_proofing = AIProofingDetector()
strategic_analyzer = StrategicAnalyzer()


# ---------------------------------------------------------------------------
# Route modules registration
# ---------------------------------------------------------------------------

from app.routes import health, ats
from app.routes.ats import AnalyzeRequest
from app.api.ai_routes import router as ai_router
from app.api.adaptations_routes import adaptations_router

app.include_router(health.router)
app.include_router(ats.router)
app.include_router(ai_router)
app.include_router(adaptations_router)






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
        raise HTTPException(status_code=502, detail="Strategic analysis failed") from exc


@app.post("/api/v1/strategic/entities", response_model=EntitiesResponse)
async def strategic_entities(payload: AnalyzeRequest):
    """Extract entities from resume or JD."""
    try:
        text = payload.resume_text or payload.job_description or ""
        return entity_extractor.extract(text)
    except Exception as exc:
        logger.error("strategic/entities failed: %s", exc)
        raise HTTPException(status_code=502, detail="Entity extraction failed") from exc


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
        raise HTTPException(status_code=502, detail="Keyword injection failed") from exc


@app.post("/api/v1/strategic/ai-proof", response_model=AIProofingAnalysis)
async def ai_proof(payload: AnalyzeRequest):
    """Analyze resume for AI-detection risks."""
    try:
        return ai_proofing.analyze(payload.resume_text or "")
    except Exception as exc:
        logger.error("strategic/ai-proof failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI proofing failed") from exc


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
        raise HTTPException(status_code=500, detail="JSON export failed") from exc


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
    except LLMNotConfiguredError as exc:
        logger.error("optimizer/optimize: LLM not configured/available: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except Exception as exc:
        logger.error("optimizer/optimize failed: %s", exc)
        raise HTTPException(status_code=502, detail="Optimization failed") from exc


@app.post("/api/v1/optimize/stream")
async def optimize_resume_stream(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    target_role: Optional[str] = Form(None),
):
    """Stream resume optimization results as Server-Sent Events."""
    import json as _json

    # Parse resume
    if resume_file:
        data = await resume_file.read()
        parsed = ResumeParser.parse_file(data, resume_file.filename or "resume.pdf")
        resume_text = parsed.raw_text or ""
    elif not resume_text:
        raise HTTPException(400, "Provide resume_text or resume_file")
    
    async def event_generator():
        try:
            # Yield start event
            yield f"data: {_json.dumps({'type': 'status', 'message': 'Analyzing resume...'})}\n\n"
            
            # Phase 1: Parse and extract
            yield f"data: {_json.dumps({'type': 'status', 'message': 'Extracting key information...'})}\n\n"
            
            # Phase 2: First pass optimization
            yield f"data: {_json.dumps({'type': 'status', 'message': 'Generating optimized version...'})}\n\n"
            
            result = await optimizer.optimize_with_reflection(
                resume_text=resume_text,
                job_description=job_description,
                target_role=target_role,
            )
            
            # Stream the optimized text in chunks
            text = result["optimized_text"]
            chunk_size = 100
            for i in range(0, len(text), chunk_size):
                chunk = text[i:i + chunk_size]
                yield f"data: {_json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                await asyncio.sleep(0.01)
            
            # Yield metadata
            meta_payload = {
                'type': 'meta',
                'payload': {
                    'changes': result.get('changes', []),
                    'keywords_added': result.get('keywords_added', []),
                    'estimated_score': result.get('estimated_score'),
                    'refinement_passes': result.get('refinement_passes', 1),
                },
            }
            yield f"data: {_json.dumps(meta_payload)}\n\n"
            
            yield "data: [DONE]\n\n"

        except LLMNotConfiguredError as e:
            logger.error("Streaming optimization: LLM not configured/available: %s", e)
            yield f"data: {_json.dumps({'type': 'error', 'error': 'ai_service_unavailable', 'message': 'LLM not configured'})}\n\n"
        except Exception as e:
            logger.error("Streaming optimization failed: %s", e)
            # ponytail: generic message to client; full detail stays server-side via logger.error above
            yield f"data: {_json.dumps({'type': 'error', 'message': 'Optimization failed'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


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
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None


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
            user_id=payload.user_id,
            conversation_id=payload.conversation_id,
        )
        return result
    except Exception as exc:
        logger.error("jobs/search failed: %s", exc)
        raise HTTPException(status_code=502, detail="Job search failed") from exc


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
        logger.error("export/docx failed: %s", exc)
        raise HTTPException(status_code=500, detail="DOCX export failed") from exc


class CoverLetterRequest(BaseModel):
    resume_text: str
    job_title: str
    company: str
    job_description: str
    tone: Optional[str] = "formal"
    personal_notes: Optional[str] = ""


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
            personal_notes=payload.personal_notes or "",
        )
        return result
    except Exception as exc:
        logger.error("cover-letter/generate failed: %s", exc)
        raise HTTPException(status_code=502, detail="Cover letter generation failed") from exc


class LinkedInAnalyzeRequest(BaseModel):
    profile_text: str


@app.post("/api/v1/linkedin/analyze")
async def linkedin_analyze(payload: LinkedInAnalyzeRequest):
    try:
        result = await score_linkedin_profile(payload.profile_text)
        return result
    except Exception as exc:
        logger.error("linkedin/analyze failed: %s", exc)
        raise HTTPException(status_code=502, detail="LinkedIn analysis failed") from exc


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
        raise HTTPException(status_code=502, detail="Communication generation failed") from exc


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
        raise HTTPException(status_code=502, detail="Interview prep failed") from exc


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
        raise HTTPException(status_code=502, detail="Knowledge graph extraction failed") from exc


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
        raise HTTPException(status_code=502, detail="Profile import failed") from exc


class GuardrailsCheckRequest(BaseModel):
    resume_text: str
    original_text: Optional[str] = None


@app.post("/api/v1/guardrails/check")
async def guardrails_check(payload: GuardrailsCheckRequest):
    """Run guardrails on provided resume text.

    Without ``original_text`` the truthfulness guardrail cannot be verified, so
    the response reports it as not passed / not verified rather than a clean
    pass. Send the pre-optimization resume as ``original_text`` for a real check.
    """
    gate = PipelineGate()
    return gate.check(
        optimized_text=payload.resume_text,
        original_text=payload.original_text,
    )


# ---------------------------------------------------------------------------
# Hermes agent layer (WS-E) — scrape, cached jobs, run status
# ---------------------------------------------------------------------------

from app.api.hermes_routes import hermes_router  # noqa: E402
from app.api.career_intelligence import router as career_intel_router  # noqa: E402
from app.api.resume_graph import router as resume_graph_router  # noqa: E402
from app.api.voice_stream import router as voice_stream_router  # noqa: E402
from app.api.predictive import router as predictive_router  # noqa: E402
from app.api.knowledge_hub import router as knowledge_hub_router  # noqa: E402
from app.api.gmail_routes import router as gmail_ai_router  # noqa: E402
from app.api.agents_routes import router as agents_router  # noqa: E402
from app.api.career_ops_routes import router as career_ops_router  # noqa: E402
from app.api.skill_routes import skill_router  # noqa: E402
from app.api.conversation_routes import conversation_router  # noqa: E402
from app.api.preference_routes import preference_router  # noqa: E402

app.include_router(hermes_router)
app.include_router(career_intel_router)
app.include_router(resume_graph_router)
app.include_router(voice_stream_router)
app.include_router(predictive_router)
app.include_router(knowledge_hub_router)
app.include_router(gmail_ai_router)
app.include_router(agents_router)
app.include_router(skill_router)
app.include_router(conversation_router)
app.include_router(preference_router)
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
    except LLMNotConfiguredError as exc:
        logger.error("resumes/analyze-text: LLM not configured/available: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except Exception as exc:
        logger.error("resumes/analyze-text failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI analysis failed") from exc
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
        logger.error("applications/interview-questions failed: %s", exc)
        raise HTTPException(status_code=502, detail="Interview questions generation failed") from exc


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
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None


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
            user_id=payload.user_id,
            conversation_id=payload.conversation_id,
        )
        _emit("complete", f"Found {len(result.get('jobs', []))} ranked matches")
        return {"events": events, "result": result}
    except Exception as exc:
        logger.error("jobs/agent-search failed: %s", exc)
        _emit("error", "Agent search failed")
        raise HTTPException(status_code=502, detail="Agent search failed") from exc


class BrowserAutomationRequest(BaseModel):
    instruction: str
    max_steps: Optional[int] = 25


@app.post("/api/v1/browser/automation")
@app.post("/api/browser/automation")
async def browser_automation_endpoint(payload: BrowserAutomationRequest):
    """Execute autonomous browser instruction via browser-use + Playwright."""
    from app.services.browser_automation import run_browser_agent
    try:
        result = await run_browser_agent(payload.instruction, max_steps=payload.max_steps or 25)
        return {
            "success": result.success,
            "instruction": result.instruction,
            "summary": result.summary,
            "visited_urls": result.visited_urls,
            "actions": result.actions,
            "error": result.error,
            "markdown": result.to_markdown(),
        }
    except Exception as exc:
        logger.error("browser automation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# One-Stop Jobseeker Endpoints (Typst, Radar, Voice Coach, Negotiation)
# ---------------------------------------------------------------------------

class TypstExportRequest(BaseModel):
    profile_data: dict
    template: Optional[str] = "executive"


@app.post("/api/v1/export/typst-pdf")
@app.post("/api/export/typst-pdf")
async def export_typst_pdf_endpoint(payload: TypstExportRequest):
    """Compile profile/resume JSON into single-page Typst PDF."""
    from app.export.typst_exporter import generate_typst_code, compile_typst_to_pdf
    try:
        code = generate_typst_code(payload.profile_data, template=payload.template or "executive")
        pdf_bytes = compile_typst_to_pdf(code)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume_typst.pdf"'},
        )
    except Exception as exc:
        logger.error("typst pdf export failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class GenerateResumePdfRequest(BaseModel):
    resume_text: str
    profile_data: Optional[dict] = None
    analysis: dict
    applied_suggestions: list[str] = []
    job_description: Optional[str] = None
    template: Optional[str] = "professional"


class OptimizedProfileExperience(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    dates: Optional[str] = None
    bullets: list[str] = []


class OptimizedProfileEducation(BaseModel):
    degree: Optional[str] = None
    school: Optional[str] = None
    year: Optional[str] = None


class OptimizedProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    skills: list[str] = []
    experience: list[OptimizedProfileExperience] = []
    education: list[OptimizedProfileEducation] = []


_UI_TEMPLATE_MAP = {
    "modern": "modern_tech",
    "professional": "executive_slate",
    "creative": "creative_compact",
    "minimal": "minimalist_ats",
    "tech": "faang_single_page",
    "executive": "executive",
}
_TEMPLATE_FALLBACK = "executive_slate"


def _resolve_template(template: str) -> str:
    # ponytail: unknown UI template names fall back to executive_slate
    return _UI_TEMPLATE_MAP.get(template or "", _TEMPLATE_FALLBACK)


def _format_dates(start: Optional[str], end: Optional[str]) -> str:
    if start and end:
        return f"{start} \u2013 {end}"
    return start or end or ""


def _map_profile_keys(profile_data: dict) -> dict:
    mapped = {
        "full_name": profile_data.get("full_name") or profile_data.get("name"),
        "email": profile_data.get("email"),
        "phone": profile_data.get("phone"),
        "linkedin": profile_data.get("linkedin"),
        "location": profile_data.get("location"),
        "summary": profile_data.get("summary"),
    }
    raw_skills = profile_data.get("skills")
    if isinstance(raw_skills, list):
        mapped["skills"] = [s.get("name") if isinstance(s, dict) else s for s in raw_skills if s]
    raw_exp = profile_data.get("experience")
    if isinstance(raw_exp, list):
        experience = []
        for item in raw_exp:
            if not isinstance(item, dict):
                continue
            bullets = item.get("bullets") or item.get("achievements") or []
            if not bullets and item.get("description"):
                bullets = [item["description"]]
            experience.append({
                "title": item.get("title"),
                "company": item.get("company"),
                "dates": item.get("dates") or _format_dates(item.get("startDate"), item.get("endDate")),
                "bullets": bullets,
            })
        mapped["experience"] = experience
    raw_edu = profile_data.get("education")
    if isinstance(raw_edu, list):
        education = []
        for item in raw_edu:
            if not isinstance(item, dict):
                continue
            education.append({
                "degree": item.get("degree"),
                "school": item.get("school") or item.get("institution"),
                "year": item.get("year"),
            })
        mapped["education"] = education
    return mapped


@app.post("/api/v1/resumes/generate-pdf")
@app.post("/api/resumes/generate-pdf")
async def generate_resume_pdf_endpoint(payload: GenerateResumePdfRequest):
    """LLM-optimize resume content, render it to a PDF via local Typst, return base64."""
    if not payload.resume_text or not payload.analysis:
        raise HTTPException(status_code=400, detail="resume_text and analysis are required")
    if len(payload.resume_text) > 50_000:
        raise HTTPException(status_code=400, detail="resume_text exceeds 50000 characters")
    if payload.job_description and len(payload.job_description) > 20_000:
        raise HTTPException(status_code=400, detail="job_description exceeds 20000 characters")
    if len(payload.applied_suggestions) > 50:
        raise HTTPException(status_code=400, detail="applied_suggestions exceeds 50 items")

    analysis = payload.analysis
    system_prompt = (
        "You are an expert resume writer. Your task is to optimize and improve the given resume "
        "based on the analysis feedback and applied suggestions. Make improvements subtle but "
        "impactful. Add missing keywords naturally where appropriate. Quantify achievements with "
        "specific numbers where possible. Return the optimized resume as a single JSON profile "
        "object (full_name, email, phone, linkedin, location, summary, skills, experience, education)."
    )
    user_prompt = f"Original Resume:\n{payload.resume_text}\n\n"
    if payload.job_description:
        user_prompt += f"Target Job Description:\n{payload.job_description}\n\n"
    if not payload.profile_data:
        user_prompt += (
            "No parsed profile is available: construct the complete resume profile "
            "(full_name, email, phone, linkedin, location, summary, skills, experience, education) "
            "from the resume text alone.\n\n"
        )
    user_prompt += (
        "Analysis Summary:\n"
        f"- Overall Score: {analysis.get('overall_score', 'N/A')}/100\n"
        f"- {analysis.get('summary_recommendation', '')}\n"
    )
    missing_keywords = analysis.get("missing_keywords") or []
    if missing_keywords:
        user_prompt += f"\nMissing keywords to naturally incorporate: {', '.join(str(k) for k in missing_keywords)}\n"
    if payload.applied_suggestions:
        suggestions = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(payload.applied_suggestions))
        user_prompt += f"\nApplied suggestions to incorporate:\n{suggestions}"

    try:
        optimized = await llm_json(system_prompt, user_prompt, response_model=OptimizedProfile)
        # ponytail: with no parsed profile the LLM output IS the profile (no
        # skeleton to merge onto); with one, structured data wins over LLM output.
        profile = _map_profile_keys(payload.profile_data) if payload.profile_data else {}
        for key, value in optimized.model_dump(exclude_none=True).items():
            if value:
                profile[key] = value

        from app.export.typst_exporter import generate_typst_code, compile_typst_to_pdf
        code = generate_typst_code(profile, template=_resolve_template(payload.template))
        pdf_bytes = compile_typst_to_pdf(code)
        if not pdf_bytes:
            raise HTTPException(status_code=500, detail="PDF compilation returned no bytes")
        import base64
        return {"pdf_base64": base64.b64encode(pdf_bytes).decode("ascii")}
    except LLMNotConfiguredError as exc:
        logger.error("resumes/generate-pdf: LLM not configured/available: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("resumes/generate-pdf failed: %s", exc)
        raise HTTPException(status_code=502, detail="Resume PDF generation failed") from exc


class RadarCheckRequest(BaseModel):
    companies: list[str]
    keywords: Optional[list[str]] = None


@app.post("/api/v1/radar/check")
@app.post("/api/radar/check")
async def radar_check_endpoint(payload: RadarCheckRequest):
    """Scan target company career boards for 15-minute job alerts."""
    from app.services.company_radar import monitor_target_companies
    try:
        return await monitor_target_companies(payload.companies, keywords=payload.keywords)
    except Exception as exc:
        logger.error("radar check failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class VoiceFeedbackRequest(BaseModel):
    transcript: str
    duration_seconds: Optional[float] = 30.0
    target_role: Optional[str] = "Software Engineer"


@app.post("/api/v1/interview/voice-feedback")
@app.post("/api/interview/voice-feedback")
async def voice_feedback_endpoint(payload: VoiceFeedbackRequest):
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


@app.post("/api/v1/negotiation/generate")
@app.post("/api/negotiation/generate")
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
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class SkillGapRequest(BaseModel):
    resume_skills: list[str]
    job_description: str


@app.post("/api/v1/skill-gap/analyze")
@app.post("/api/skill-gap/analyze")
async def skill_gap_analyze_endpoint(payload: SkillGapRequest):
    """Analyze missing skill gaps against target JD and attach free learning resources."""
    from app.services.skill_gap_radar import analyze_skill_gaps
    try:
        return await analyze_skill_gaps(
            resume_skills=payload.resume_skills,
            job_description=payload.job_description,
        )
    except Exception as exc:
        logger.error("skill gap analyze failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class PortfolioRequest(BaseModel):
    full_name: str
    headline: str
    summary: str
    skills: list[str]


@app.post("/api/v1/portfolio/generate")
@app.post("/api/portfolio/generate")
async def portfolio_endpoint(payload: PortfolioRequest):
    """Generate responsive HTML portfolio website."""
    from app.services.portfolio_generator import generate_portfolio_html
    try:
        html = generate_portfolio_html(payload.dict())
        return {"html": html}
    except Exception as exc:
        logger.error("portfolio generate failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class OutreachRequest(BaseModel):
    recruiter_name: str
    company: str
    target_role: str
    candidate_proof_points: str


@app.post("/api/v1/outreach/generate")
@app.post("/api/outreach/generate")
async def outreach_endpoint(payload: OutreachRequest):
    """Generate recruiter cold email and LinkedIn note."""
    from app.services.outreach_copilot import generate_recruiter_outreach
    try:
        return await generate_recruiter_outreach(
            recruiter_name=payload.recruiter_name,
            company=payload.company,
            target_role=payload.target_role,
            candidate_proof_points=payload.candidate_proof_points,
        )
    except Exception as exc:
        logger.error("outreach generate failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class FunnelAnalyticsRequest(BaseModel):
    applications: Optional[list[dict]] = None


@app.post("/api/v1/analytics/funnel")
@app.post("/api/analytics/funnel")
async def analytics_funnel_endpoint(payload: FunnelAnalyticsRequest):
    """Calculate conversion funnel metrics and optimization interventions."""
    from app.services.analytics_service import calculate_conversion_funnel
    try:
        stats = calculate_conversion_funnel(payload.applications or [])
        return {
            "total_applied": stats.total_applied,
            "responses_received": stats.responses_received,
            "interviews_scheduled": stats.interviews_scheduled,
            "offers_received": stats.offers_received,
            "response_rate": stats.response_rate,
            "interview_rate": stats.interview_rate,
            "offer_rate": stats.offer_rate,
            "health_status": stats.health_status,
            "recommendations": stats.recommendations,
        }
    except Exception as exc:
        logger.error("funnel analytics failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/v1/privacy/check")
@app.get("/api/v1/privacy/check")
@app.post("/api/privacy/check")
async def privacy_check_endpoint():
    """Verify local AI engine status and zero data leakage privacy audit."""
    from app.services.privacy_check import check_privacy_and_offline_status
    try:
        return check_privacy_and_offline_status()
    except Exception as exc:
        logger.error("privacy check failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/v1/one-shot/execute")
@app.post("/api/one-shot/execute")
async def one_shot_execute_endpoint(payload: OneShotRequest):
    """Execute the complete 6-stage one-shot jobseeker application pipeline."""
    from app.services.one_shot_engine import execute_one_shot_pipeline
    try:
        res = await execute_one_shot_pipeline(payload)
        return res.dict()
    except Exception as exc:
        logger.error("one-shot pipeline execution failed: %s", exc)
        raise HTTPException(status_code=500, detail="One-shot pipeline execution failed") from exc


@app.post("/api/v1/ats/simulate")
async def ats_simulate_endpoint(payload: dict):
    """Simulate ATS plain-text parsing and warning diagnostic."""
    from app.services.ats_simulator import simulate_ats_parsing
    resume_text = payload.get("resume_text", "")
    return simulate_ats_parsing(resume_text)


@app.post("/api/v1/interview/copilot-hint")
async def interview_copilot_hint_endpoint(payload: dict):
    """Generate real-time STAR response hints during live interview."""
    from app.services.live_interview_copilot import CopilotHintRequest, generate_interview_hint
    req = CopilotHintRequest(**payload)
    res = await generate_interview_hint(req)
    return res.dict()


@app.get("/api/v1/candidate/answers")
async def candidate_answers_endpoint():
    """Retrieve stored candidate answer bank."""
    from app.services.candidate_answer_bank import DEFAULT_ANSWER_BANK
    return DEFAULT_ANSWER_BANK.dict()



@app.post("/api/v1/typst/compile")
async def typst_compile_endpoint(payload: dict):
    """Generate Typst code and compile into PDF binary or plain string."""
    from app.export.typst_exporter import generate_typst_code, compile_typst_to_pdf
    template = payload.get("template", "modern_tech")
    resume_data = payload.get("resume_data", payload)
    typst_code = generate_typst_code(resume_data, template=template)
    try:
        pdf_bytes = compile_typst_to_pdf(typst_code)
        if isinstance(pdf_bytes, bytes) and len(pdf_bytes) > 0:
            import base64
            return {
                "template": template,
                "typst_code": typst_code,
                "pdf_available": True,
                "pdf_data": base64.b64encode(pdf_bytes).decode("utf-8"),
            }
        return {
            "template": template,
            "typst_code": typst_code,
            "pdf_available": False,
        }
    except Exception as exc:
        logger.warning("typst compilation unavailable: %s", exc)
        return {
            "template": template,
            "typst_code": typst_code,
            "pdf_available": False,
        }


@app.post("/api/v1/interview/voice-feedback")
async def voice_feedback_endpoint(payload: dict):
    """Analyze candidate speech cadence (WPM), filler words, and STAR coverage."""
    from app.services.live_interview_copilot import VoiceAnalysisRequest, analyze_candidate_speech
    req = VoiceAnalysisRequest(**payload)
    return analyze_candidate_speech(req).dict()


@app.post("/api/v1/recruiter/patterns")
async def recruiter_patterns_endpoint(payload: dict):
    """Generate corporate email permutations and multi-touch cold outreach sequence."""
    from app.services.recruiter_intelligence import find_recruiter_intel
    company_name = payload.get("company_name", "Target Company")
    job_title = payload.get("job_title", "Software Engineer")
    return find_recruiter_intel(company_name, job_title)


@app.post("/api/v1/agent-reach/extract")
async def agent_reach_extract_endpoint(payload: dict):
    """Extract YouTube transcripts, LinkedIn posts, Substack/Medium articles & Reddit threads into Knowledge Graph."""
    from app.services.agent_reach import AgentReachRequest, process_agent_reach
    req = AgentReachRequest(**payload)
    res = await process_agent_reach(req)
    return res.dict()


@app.get("/api/v1/agent-reach/doctor")
async def agent_reach_doctor_endpoint():
    """Run diagnostic health check across all 16 Agent-Reach channels and local cookies."""
    from app.services.agent_reach import run_agent_reach_doctor
    report = run_agent_reach_doctor()
    return report.dict()


@app.post("/api/v1/agent-reach/search")
async def agent_reach_search_endpoint(payload: dict):
    """Perform Exa AI semantic search over web and career platforms."""
    from app.services.agent_reach import run_exa_search
    query = payload.get("query", "Software Engineer Interview Prep")
    results = await run_exa_search(query)
    return {"query": query, "results": results}


@app.post("/api/v1/agent-reach/transcribe")
async def agent_reach_transcribe_endpoint(payload: dict):
    """Transcribe audio/video podcast or URL using Whisper API (Groq/OpenAI)."""
    from app.services.agent_reach_transcribe import process_audio_transcription
    url = payload.get("url", "")
    provider = payload.get("provider", "auto")
    transcript = await process_audio_transcription(url, provider=provider)
    return {"url": url, "provider": provider, "transcript": transcript}


@app.get("/api/v1/agent-reach/cookies")
async def agent_reach_cookies_endpoint():
    """Inspect local system browser cookie availability."""
    from app.services.agent_reach import extract_browser_cookies
    return {"browsers": extract_browser_cookies()}


@app.post("/api/v1/candidate-bank/match")
async def match_candidate_bank_endpoint(payload: dict):
    """Match ATS form label against deterministic candidate answer bank."""
    from app.services.candidate_answer_bank import match_question_to_answer, CandidateAnswers
    question = payload.get("question_text", "")
    custom_qa = payload.get("custom_qa", {})
    bank = CandidateAnswers(custom_qa=custom_qa)
    return match_question_to_answer(question, bank)


@app.post("/api/v1/ats/detect")
async def detect_ats_endpoint(payload: dict):
    """Detect ATS vendor from job post URL or HTML snippet and return tailored formatting rules."""
    from app.services.ats_detector import detect_ats_from_url
    url = payload.get("url", "")
    html_snippet = payload.get("html_snippet", "")
    rules = detect_ats_from_url(url, html_snippet)
    return rules


@app.post("/api/v1/guardrails/truth-check")
async def truth_check_endpoint(payload: dict):
    """Verify optimized resume against master profile to flag hallucinated titles or metrics."""
    from app.guardrails.truth_gate import verify_resume_truthfulness
    orig = payload.get("original_text", "")
    opt = payload.get("optimized_text", "")
    res = verify_resume_truthfulness(orig, opt)
    return res


@app.post("/api/v1/recruiter/lookup")
async def recruiter_lookup_endpoint(payload: dict):
    """Generate recruiter email candidates, pattern heuristics, and warm referral intro templates."""
    from app.services.recruiter_intelligence import generate_recruiter_intelligence
    company = payload.get("company_name", "Target Company")
    title = payload.get("job_title", "Software Engineer")
    manager = payload.get("hiring_manager_name")
    user = payload.get("user_name", "Candidate")
    skills = payload.get("user_skills", [])
    intel = generate_recruiter_intelligence(company, title, manager, user, skills)
    return intel


@app.post("/api/v1/offer/calculate")
async def offer_calculate_endpoint(payload: dict):
    """Calculate annualized NPV total compensation and COL-adjusted purchasing power."""
    from app.services.offer_calculator import JobOfferInput, calculate_offer_comp
    offer_input = JobOfferInput(**payload)
    res = calculate_offer_comp(offer_input)
    return res


@app.post("/api/v1/interview/copilot")
async def live_copilot_endpoint(payload: dict):
    """Generate instant bulleted STAR framework hints and metrics for live interviewer questions."""
    from app.services.live_interview_copilot import LiveCopilotRequest, generate_live_copilot_hints
    req = LiveCopilotRequest(**payload)
    res = await generate_live_copilot_hints(req)
    return res


# ---------------------------------------------------------------------------
# Privacy Ledger & User Data Lifecycle Routes
# ---------------------------------------------------------------------------

from app.auth.dependencies import get_current_user  # noqa: E402


from datetime import datetime, timezone


@app.get("/api/v1/privacy/ledger")
@app.post("/api/v1/privacy/ledger")
async def privacy_ledger_endpoint(user_id: str = Depends(get_current_user)):
    """Fetch recent Privacy Audit Ledger entries for user."""
    from app.services.privacy_ledger import ledger
    logs = await ledger.query_user_log(user_id=user_id)
    return {"status": "ok", "ledger": logs, "count": len(logs)}


@app.post("/api/v1/privacy/clear-ledger")
async def privacy_clear_ledger_endpoint(user_id: str = Depends(get_current_user)):
    """Clear Privacy Audit Ledger entries for user."""
    from app.services.privacy_ledger import ledger
    await ledger.clear_user_log(user_id=user_id)
    return {"status": "ok", "message": "Privacy audit log wiped successfully"}


@app.get("/api/v1/user/export-data")
@app.post("/api/v1/user/export-data")
async def export_user_data_endpoint(request: Request, user_id: str = Depends(get_current_user)):
    """Export complete user data archive as JSON."""
    from app.services.privacy_ledger import ledger
    now_iso = datetime.now(timezone.utc).isoformat()

    go_gateway_url = (
        os.getenv("GO_GATEWAY_URL")
        or os.getenv("GO_API_URL")
        or os.getenv("GO_BACKEND_URL")
        or "http://127.0.0.1:8080"
    ).rstrip("/")

    archive = {
        "status": "ok",
        "exported_at": now_iso,
        "user_id": user_id,
        "profile": None,
        "resumes": [],
        "applications": [],
        "cover_letters": [],
        "settings": {"privacy_mode": "LOCAL_FIRST_ZERO_DATA_LEAKAGE"},
        "privacy_ledger": None,
        "unavailable_sections": [],
    }

    auth_header = request.headers.get("authorization")
    gateway_headers = {"x-user-id": user_id}
    if auth_header:
        gateway_headers["authorization"] = auth_header

    # ponytail: the Go gateway owns all persisted user data (profiles, resumes,
    # applications, cover letters). Query it once and map the response onto the
    # archive; any section the gateway does not return is marked unavailable
    # rather than fabricated.
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{go_gateway_url}/api/v1/account/export", headers=gateway_headers)
        if resp.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"Go gateway export returned status {resp.status_code}",
                request=resp.request,
                response=resp,
            )
        data = resp.json()
    except Exception as exc:
        logger.error("export-data: gateway query failed: %s", exc)
        gateway_failed = True
        for section in ("profile", "resumes", "applications", "cover_letters"):
            archive[section] = [] if section != "profile" else None
            archive["unavailable_sections"].append(section)
        data = {}
    else:
        gateway_failed = False

    def mark_unavailable(section: str) -> None:
        if section not in archive["unavailable_sections"]:
            archive["unavailable_sections"].append(section)

    if gateway_failed:
        # ponytail: the gateway already marked every section unavailable above;
        # skip the per-section checks so no section is appended twice.
        pass
    else:
        profile = data.get("profile") if isinstance(data, dict) else None
        if profile:
            archive["profile"] = profile
        else:
            mark_unavailable("profile")

        resumes = data.get("resumes") if isinstance(data, dict) else None
        if isinstance(resumes, list):
            archive["resumes"] = resumes
        else:
            mark_unavailable("resumes")

        applications = data.get("applications") if isinstance(data, dict) else None
        if isinstance(applications, list):
            archive["applications"] = applications
        else:
            mark_unavailable("applications")

        cover_letters = []
        if isinstance(applications, list):
            for application_item in applications:
                if not isinstance(application_item, dict):
                    continue
                cl = application_item.get("cover_letter")
                if isinstance(cl, str) and cl.strip():
                    cover_letters.append({"application_id": application_item.get("id"), "cover_letter": cl})
        if not cover_letters and isinstance(data, dict) and "cover_letters" in data:
            # ponytail: the gateway explicitly returned a cover_letters section —
            # even an empty list means the section exists, so only fall back to
            # the raw extraction when the key is absent entirely. Marking the
            # section unavailable when the gateway provided an (empty) list would
            # misreport present-but-empty data as missing.
            raw_cover_letters = data.get("cover_letters")
            if isinstance(raw_cover_letters, list):
                cover_letters = raw_cover_letters
        archive["cover_letters"] = cover_letters
        # ponytail: mark the section unavailable only when the gateway truly
        # omitted it (absent, or present but not a list). A present empty list
        # means the section exists and simply has no entries — reporting it as
        # unavailable would misrepresent present-but-empty data as missing.
        gateway_cover_letters = data.get("cover_letters") if isinstance(data, dict) else None
        if not cover_letters and not isinstance(gateway_cover_letters, list):
            mark_unavailable("cover_letters")

    # ponytail: wrap the privacy-ledger query in the same exception-handling
    # pattern used for other export sources so a ledger failure does not
    # abort the whole export and the user sees which section is unavailable.
    try:
        archive["privacy_ledger"] = await ledger.query_user_log(user_id=user_id, limit=500)
    except Exception as exc:
        logger.error("export-data: privacy ledger query failed: %s", exc)
        archive["privacy_ledger"] = None
        archive["unavailable_sections"].append("privacy_ledger")

    # ponytail: the export archive is already assembled; a ledger write failure
    # must not abort the export. Log it and return the archive untouched, the
    # same non-blocking pattern used for the privacy-ledger query above.
    try:
        await ledger.record(
            user_id=user_id,
            action="data_export",
            resource="/api/v1/user/export-data",
            detail={"archive_type": "JSON", "exported_at": now_iso}
        )
    except Exception as exc:
        logger.error("export-data: privacy ledger record failed: %s", exc)
    return archive


@app.delete("/api/v1/user/account")
@app.post("/api/v1/user/account/delete")
async def delete_user_account_endpoint(request: Request, user_id: str = Depends(get_current_user)):
    """Cascade delete user account records via primary database owner."""
    import os
    import httpx
    from app.services.privacy_ledger import ledger

    go_gateway_url = (
        os.getenv("GO_GATEWAY_URL")
        or os.getenv("GO_API_URL")
        or os.getenv("GO_BACKEND_URL")
        or "http://127.0.0.1:8080"
    ).rstrip("/")

    headers = {}
    auth_header = request.headers.get("authorization")
    if auth_header:
        headers["authorization"] = auth_header
    headers["x-user-id"] = user_id

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"{go_gateway_url}/api/v1/account",
                headers=headers
            )

        if resp.status_code >= 400:
            err_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"detail": resp.text}
            err_msg = err_data.get("detail") or err_data.get("error") or f"Go API Gateway returned status {resp.status_code}"
            await ledger.record(
                user_id=user_id,
                action="account_delete_failed",
                resource="/api/v1/user/account",
                detail={"wipe_status": "FAILED", "status_code": resp.status_code, "error": err_msg, "timestamp": now_iso}
            )
            if resp.status_code >= 500:
                raise HTTPException(
                    status_code=502,
                    detail="Account deletion gateway error. Primary database owner service encountered an internal failure."
                )
            raise HTTPException(status_code=resp.status_code, detail=err_msg)

        resp_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"message": resp.text}
        await ledger.record(
            user_id=user_id,
            action="account_delete_completed",
            resource="/api/v1/user/account",
            detail={"wipe_status": "DELEGATED_COMPLETED", "gateway_response": resp_data, "timestamp": now_iso}
        )
        return {
            "status": "ok",
            "message": "Account deletion completed via Go API Gateway.",
            "gateway_response": resp_data
        }
    except HTTPException:
        raise
    except Exception as exc:
        # ponytail: full detail stays server-side via logger/ledger; the client
        # gets a generic 502 so gateway internals never leak in the response.
        logger.error("account deletion gateway error: %s", exc)
        try:
            await ledger.record(
                user_id=user_id,
                action="account_delete_failed",
                resource="/api/v1/user/account",
                detail={"wipe_status": "DELEGATED_NETWORK_ERROR", "error": str(exc), "timestamp": now_iso}
            )
        except Exception as ledger_exc:
            logger.error("account delete ledger record failed: %s", ledger_exc)
        raise HTTPException(
            status_code=502,
            detail="Account deletion gateway error. Primary database owner service encountered an internal failure.",
        ) from exc




# ---------------------------------------------------------------------------
# Plugin registration (backward compat)
# ---------------------------------------------------------------------------

from app.plugins import register_plugins  # noqa: E402



register_plugins(app)


if __name__ == "__main__":
    import uvicorn  # noqa: E402

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))


@app.post("/api/v1/interview/copilot/stream")
async def live_copilot_stream_endpoint(payload: dict):
    """SSE stream of progressive STAR hints for live interviewer questions."""
    import json as _json
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


@app.post("/api/v1/browser/automation/stream")
async def browser_automation_stream_endpoint(payload: dict):
    """SSE stream of per-step browser screenshots for the Glass-Box live feed."""
    import json as _json
    from app.services.browser_automation.agent import stream_browser_agent

    instruction = str(payload.get("instruction", ""))
    max_steps = int(payload.get("max_steps") or 25)

    async def event_stream():
        async for event in stream_browser_agent(instruction, max_steps=max_steps):
            yield f"data: {_json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
