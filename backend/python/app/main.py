"""
Tayari AI Engine — FastAPI entry point.
"""
import asyncio
import io
import json
import logging
import os
from ipaddress import ip_address
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


def rate_limit_key(request: Request) -> str:
    """Use user-plus-IP for authenticated calls and IP for anonymous calls.

    The production Python service is reachable only through the Go gateway. That
    gateway resolves the client address after evaluating trusted proxy CIDRs and
    forwards the canonical address in ``X-Tayari-Client-IP``. Falling back to the
    TCP peer keeps direct local-development calls working without trusting an
    arbitrary forwarded header.
    """
    user_id = (request.headers.get("X-User-Id") or "").strip()
    forwarded_ip = (request.headers.get("X-Tayari-Client-IP") or "").strip()
    try:
        ip = str(ip_address(forwarded_ip)) if forwarded_ip else get_remote_address(request)
    except ValueError:
        ip = get_remote_address(request)
    return f"user:{user_id}:ip:{ip}" if user_id else f"anon:ip:{ip}"


_env_for_limits = os.getenv("ENV", "development").lower()
_rate_limit_storage = os.getenv("RATELIMIT_STORAGE_URL") or os.getenv("REDIS_URL")
if _env_for_limits == "production" and not _rate_limit_storage:
    raise RuntimeError("REDIS_URL or RATELIMIT_STORAGE_URL must be set in production")

limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=["100/minute"],
    storage_uri=_rate_limit_storage or "memory://",
    # A production Redis outage must fail closed rather than silently reducing
    # a multi-replica service to independent process-local buckets.
    swallow_errors=False,
)

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
from app.telemetry.product_events import ProductEventError, record_product_event
from app.services.llm_service import active_engine, llm_complete, llm_json, LLMNotConfiguredError
from app.services.one_shot_engine import OneShotRequest
from app.services.communication import CommunicationGenerator
from app.services.interview_ai import InterviewPrepGenerator
from app.services.knowledge_graph import KnowledgeGraphExtractor
from app.services.linkedin_analyzer import score_linkedin_profile
from app.middleware.internal_gateway import InternalGatewayMiddleware
from app.middleware.request_telemetry import RequestTelemetryMiddleware
from app.middleware.request_budget import RequestBudgetMiddleware
from app.middleware.operation_budget import OperationBudget, OperationBudgetMiddleware
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)


from app.a2a.agents import register_all_a2a_agents
from app.api.a2a_routes import router as a2a_router
from app.api.external_research_routes import router as external_research_router
from app.api.provenance_routes import router as provenance_router
from app.api.computer_routes import router as computer_router
from app.api.practice_outcome_routes import router as practice_outcome_router
from app.api.application_runs_routes import router as application_runs_router
from app.api.outcome_routes import router as outcome_router
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
app.include_router(external_research_router)
app.include_router(provenance_router)
app.include_router(computer_router)
app.include_router(practice_outcome_router)
app.include_router(application_runs_router)
app.include_router(outcome_router)
app.include_router(agent_router)
app.state.limiter = limiter

# Enforce the default limit for every route unless a narrower route policy overrides it.
app.add_middleware(SlowAPIMiddleware)

# Apply bounded per-operation quotas before expensive route work.
operation_budget = OperationBudget(
    redis_url=os.getenv("RATELIMIT_STORAGE_URL") or os.getenv("REDIS_URL"),
    fail_closed=_env_for_limits == "production",
)
app.add_middleware(OperationBudgetMiddleware, budget=operation_budget)

# Reject oversized request bodies before multipart/Pydantic parsing can allocate unbounded memory.
app.add_middleware(RequestBudgetMiddleware)

# The Go gateway is the only public API boundary in production. The middleware
# below rejects direct calls before route code or expensive work runs.
app.add_middleware(InternalGatewayMiddleware)

# Emit one structured JSON event per request and propagate X-Request-ID (outermost).
app.add_middleware(RequestTelemetryMiddleware)
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
    if not os.getenv("AI_INTERNAL_TOKEN", ""):
        raise RuntimeError("AI_INTERNAL_TOKEN must be set in production")
    if not os.getenv("APPROVAL_SIGNING_KEY", ""):
        raise RuntimeError("APPROVAL_SIGNING_KEY must be set in production")
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
from app.api.ai_routes import (
    router as ai_router,
)
from app.api.adaptations_routes import adaptations_router

app.include_router(health.router)
app.include_router(ats.router)
app.include_router(ai_router)
app.include_router(adaptations_router)

from app.api.strategic_routes import (
    router as strategic_router,
    StrategicInjectRequest,
    strategic_analyze,
    strategic_entities,
    strategic_inject,
    ai_proof,
)
from app.api.export_routes import (
    router as export_router,
    DocxExportRequest,
    TypstExportRequest,
    GenerateResumePdfRequest,
    OptimizedProfileExperience,
    OptimizedProfileEducation,
    OptimizedProfile,
    _UI_TEMPLATE_MAP,
    _TEMPLATE_FALLBACK,
    _resolve_template,
    _format_dates,
    _map_profile_keys,
    export_json,
    export_docx,
    export_typst_pdf_endpoint,
    generate_resume_pdf_endpoint,
    typst_compile_endpoint,
)
from app.api.browser_agent_routes import (
    router as browser_agent_router,
    BROWSER_RUN_TIMEOUT_SECONDS,
    BROWSER_CANCEL_TIMEOUT_SECONDS,
    BROWSER_MAX_STEPS_CAP,
    browser_actor,
    clamp_steps,
    require_browser_automation_capabilities,
    BrowserAutomationRequest,
    browser_automation_endpoint,
    browser_automation_stream_endpoint,
    browser_automation_control_endpoint,
    browser_automation_cancel_endpoint,
)
from app.api.privacy_lifecycle_routes import (
    router as privacy_lifecycle_router,
    privacy_check_endpoint,
    privacy_ledger_endpoint,
    privacy_clear_ledger_endpoint,
    export_user_data_endpoint,
    delete_user_account_endpoint,
    ExtensionPageAnswerRequest,
    extension_page_answer,
)
from app.api.interview_coach_routes import (
    router as interview_coach_router,
    CommunicationRequest,
    communication_generate,
    InterviewPrepRequest,
    interview_prep,
    InterviewQuestionsRequest,
    generate_interview_questions,
    VoiceFeedbackRequest,
    process_voice_feedback,
    NegotiationRequest,
    negotiation_endpoint,
    offer_calculate_endpoint,
    live_copilot_endpoint,
    live_copilot_stream_endpoint,
)

app.include_router(strategic_router)
app.include_router(export_router)
app.include_router(browser_agent_router)
app.include_router(privacy_lifecycle_router)
app.include_router(interview_coach_router)


@app.post("/api/v1/interview/voice-feedback")
@app.post("/api/interview/voice-feedback")
async def voice_feedback_endpoint(
    payload: VoiceFeedbackRequest,
    _user_id: str = Depends(get_current_user),
):
    return process_voice_feedback(payload)








# ---------------------------------------------------------------------------
# Optimizer, Deep ATS, Job Search, Auto-Pilot
# ---------------------------------------------------------------------------


@app.post("/api/v1/optimize/stream")
async def optimize_resume_stream(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    target_role: Optional[str] = Form(None),
    custom_instructions: Optional[str] = Form(None),
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
                custom_instructions=custom_instructions,
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
async def jobs_search(
    payload: JobSearchRequest,
    _user_id: str = Depends(get_current_user),
):
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
            user_id=_user_id,
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
    candidate_name: Optional[str] = None


_AUTOPILOT_QUEUE_CAPACITY = max(
    1, min(int(os.getenv("AUTOPILOT_QUEUE_CAPACITY", "4")), 16)
)
_autopilot_active = 0
_autopilot_active_lock = asyncio.Lock()


async def _run_autopilot_with_capacity(*args):
    global _autopilot_active
    try:
        await automation_engine.run_autopilot(*args)
    finally:
        async with _autopilot_active_lock:
            _autopilot_active -= 1


@app.post("/api/v1/autopilot/run")
async def autopilot_run(
    payload: AutopilotRunRequest,
    _user_id: str = Depends(get_current_user),
):
    """Start a user-owned Auto-Pilot background run."""
    import asyncio
    run_id = str(__import__("uuid").uuid4())
    run_config = dict(payload.run_config or {})
    run_config["user_id"] = _user_id
    global _autopilot_active
    async with _autopilot_active_lock:
        if _autopilot_active >= _AUTOPILOT_QUEUE_CAPACITY:
            raise HTTPException(status_code=429, detail="autopilot queue is full")
        _autopilot_active += 1
    asyncio.create_task(
        _run_autopilot_with_capacity(
            run_id,
            run_config,
            payload.profile,
            payload.resume_text,
            payload.candidate_name,
        )
    )
    try:
        record_product_event(
            "review_package_created",
            user_id=_user_id,
            properties={"workflow": "autopilot", "status": "queued"},
            trace_id=run_id,
        )
    except ProductEventError as exc:
        logger.warning("product event rejected for run %s: %s", run_id, exc)
    return {"run_id": run_id, "status": "queued"}


@app.get("/api/v1/autopilot/status/{run_id}")
async def autopilot_status(
    run_id: str,
    _user_id: str = Depends(get_current_user),
):
    """Poll a user-owned Auto-Pilot run status."""
    status = automation_engine.get_run_status(run_id)
    if not status or str(status.get("user_id")) != str(_user_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return status


@app.get("/api/v1/autopilot/applications/{run_id}")
async def autopilot_applications(
    run_id: str,
    _user_id: str = Depends(get_current_user),
):
    """Get applications generated by a user-owned Auto-Pilot run."""
    status = automation_engine.get_run_status(run_id)
    if not status or str(status.get("user_id")) != str(_user_id):
        raise HTTPException(status_code=404, detail="Run not found")
    apps = automation_engine.get_applications(run_id)
    return {"applications": apps}


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
async def profile_import_text(
    payload: ProfileImportRequest,
    _user_id: str = Depends(get_current_user),
):
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
from app.api.career_intelligence import router as career_intel_router, career_router  # noqa: E402
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
app.include_router(career_router)
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
    from app.services.llm_service import LLMNotConfiguredError
    try:
        return await generate_recruiter_outreach(
            recruiter_name=payload.recruiter_name,
            company=payload.company,
            target_role=payload.target_role,
            candidate_proof_points=payload.candidate_proof_points,
        )
    except LLMNotConfiguredError as exc:
        logger.error("outreach generate: LLM not configured/available: %s", exc)
        raise HTTPException(status_code=503, detail="ai_service_unavailable") from exc
    except Exception as exc:
        logger.error("outreach generate failed: %s", exc)
        raise HTTPException(status_code=500, detail="Outreach generation failed.") from exc


class RecordOutreachRequest(BaseModel):
    company: str
    recruiter_name: str
    subject: str


@app.post("/api/v1/networking/record-outreach")
@app.post("/api/networking/record-outreach")
async def record_outreach_endpoint(
    payload: RecordOutreachRequest,
    user_id: str = Depends(get_current_user),
):
    """Record outreach confirmed by candidate with 30-day deduplication (M7-06)."""
    from app.services.outreach_copilot import check_recent_outreach_duplicate
    from app.services.db import get_pool

    company_clean = payload.company.strip()
    recruiter_clean = payload.recruiter_name.strip()
    subject_clean = payload.subject.strip()

    if not company_clean and not recruiter_clean:
        raise HTTPException(status_code=400, detail="Company or recruiter name is required.")

    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Acquire transaction-scoped advisory lock keyed by user_id to prevent concurrent duplicate outreach
            await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1::text))", str(user_id))
            rows = await conn.fetch(
                """
                SELECT c.name as recipient, c.company,
                       EXTRACT(DAY FROM now() - o.created_at)::int as days_ago
                FROM public.outreach_messages o
                LEFT JOIN public.contacts c ON o.contact_id = c.id
                WHERE o.user_id = $1::uuid
                  AND o.created_at >= now() - interval '35 days'
                """,
                user_id,
            )
            past = [dict(r) for r in rows]
            if check_recent_outreach_duplicate(past, company_clean, recruiter_clean):
                raise HTTPException(
                    status_code=409,
                    detail=f"Duplicate outreach to {recruiter_clean or 'this contact'} at {company_clean} within the last 30 days blocked.",
                )

            contact_row = None
            if recruiter_clean or company_clean:
                contact_row = await conn.fetchrow(
                    """
                    SELECT id FROM public.contacts
                    WHERE user_id = $1::uuid
                      AND LOWER(name) = LOWER($2)
                      AND LOWER(COALESCE(company, '')) = LOWER($3)
                    LIMIT 1
                    """,
                    user_id,
                    recruiter_clean or "Hiring Manager",
                    company_clean or "",
                )
                if not contact_row:
                    contact_row = await conn.fetchrow(
                        """
                        INSERT INTO public.contacts (user_id, name, company, relationship, created_at, updated_at)
                        VALUES ($1::uuid, $2, $3, 'cold', now(), now())
                        RETURNING id
                        """,
                        user_id,
                        recruiter_clean or "Hiring Manager",
                        company_clean or "",
                    )

            contact_id = contact_row["id"] if contact_row else None
            await conn.execute(
                """
                INSERT INTO public.outreach_messages (
                    user_id, contact_id, channel, kind, subject, body, status, sent_at, created_at, updated_at
                )
                VALUES (
                    $1::uuid, $2, 'email', 'intro', $3, 'Outreach confirmed and recorded by candidate via Gmail compose.', 'sent', now(), now(), now()
                )
                """,
                user_id,
                contact_id,
                subject_clean or "Outreach",
            )

    return {"success": True, "recorded": True, "message": "Outreach recorded successfully."}


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


class AgentQuestionUpdate(BaseModel):
    answer: Optional[str] = None
    status: str


class CandidateAnswerSaveRequest(BaseModel):
    answers: dict[str, Any]
    application_id: Optional[str] = None
    confirm_sensitive: bool = False


class AgentRunTransitionRequest(BaseModel):
    target_state: str
    expected_state: Optional[str] = None
    expected_version: Optional[int] = None


class AgentHandoffRequest(BaseModel):
    state: str
    expected_state: Optional[str] = None
    expected_version: Optional[int] = None
    ttl_seconds: int = 900


class AgentHandoffResumeRequest(BaseModel):
    handoff_token: str
    expected_state: Optional[str] = None
    expected_version: Optional[int] = None


@app.get("/api/v1/agent/questions")
async def agent_questions_list_endpoint(
    status: Optional[str] = Query(None),
    _user_id: str = Depends(get_current_user),
):
    """List the authenticated user's durable human-answer queue."""
    from app.services.question_queue import QuestionQueueUnavailable, list_questions_for_user
    try:
        return {"questions": await list_questions_for_user(_user_id, status=status)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except QuestionQueueUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/agent/runs/{run_id}/transition")
async def agent_run_transition_endpoint(
    run_id: str,
    payload: AgentRunTransitionRequest,
    _user_id: str = Depends(get_current_user),
):
    """Transition an owned run through the durable HITL state machine."""
    from app.services.db import transition_agent_run_for_user
    transitioned = await transition_agent_run_for_user(
        run_id,
        _user_id,
        payload.target_state,
        expected_state=payload.expected_state,
        expected_version=payload.expected_version,
    )
    if not transitioned:
        raise HTTPException(status_code=409, detail="invalid, stale, unavailable, or unauthorized run transition")
    return {"run_id": run_id, "state": payload.target_state}


@app.post("/api/v1/agent/runs/{run_id}/handoff")
async def agent_run_handoff_endpoint(
    run_id: str,
    payload: AgentHandoffRequest,
    _user_id: str = Depends(get_current_user),
):
    from app.services.handoff_service import issue_handoff
    try:
        return await issue_handoff(
            run_id,
            _user_id,
            payload.state,
            expected_state=payload.expected_state,
            expected_version=payload.expected_version,
            ttl_seconds=payload.ttl_seconds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/v1/agent/runs/{run_id}/handoff")
async def agent_run_handoff_status_endpoint(
    run_id: str,
    _user_id: str = Depends(get_current_user),
):
    from app.services.db import load_agent_run_for_user
    run = await load_agent_run_for_user(run_id, _user_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "run_id": run_id,
        "state": run.get("handoff_state") or "queued",
        "state_version": run.get("state_version", 0),
        "handoff_expires_at": run.get("handoff_expires_at"),
    }


@app.post("/api/v1/agent/runs/{run_id}/resume")
async def agent_run_resume_endpoint(
    run_id: str,
    payload: AgentHandoffResumeRequest,
    _user_id: str = Depends(get_current_user),
):
    from app.services.handoff_service import resume_handoff
    resumed = await resume_handoff(
        run_id,
        _user_id,
        payload.handoff_token,
        expected_state=payload.expected_state,
        expected_version=payload.expected_version,
    )
    if not resumed:
        raise HTTPException(status_code=409, detail="handoff token invalid, expired, stale, or unauthorized")
    return {"run_id": run_id, "state": "preparing"}


@app.post("/api/v1/agent/runs/{run_id}/cancel")
async def agent_run_cancel_endpoint(
    run_id: str,
    payload: AgentRunTransitionRequest = AgentRunTransitionRequest(target_state="cancelled"),
    _user_id: str = Depends(get_current_user),
):
    from app.services.db import transition_agent_run_for_user
    cancelled = await transition_agent_run_for_user(
        run_id,
        _user_id,
        "cancelled",
        expected_state=payload.expected_state,
        expected_version=payload.expected_version,
    )
    if not cancelled:
        raise HTTPException(status_code=409, detail="run cancellation rejected")
    return {"run_id": run_id, "state": "cancelled"}


@app.patch("/api/v1/agent/questions/{question_id}")
async def agent_question_update_endpoint(
    question_id: str,
    payload: AgentQuestionUpdate,
    _user_id: str = Depends(get_current_user),
):
    """Answer or skip one queue item only when it belongs to the caller."""
    from app.services.question_queue import QuestionQueueUnavailable, answer_question_for_user
    try:
        updated = await answer_question_for_user(
            question_id,
            _user_id,
            answer=payload.answer,
            status=payload.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except QuestionQueueUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    return updated


@app.post("/api/v1/one-shot/execute")
@app.post("/api/one-shot/execute")
async def one_shot_execute_endpoint(
    payload: OneShotRequest,
    _user_id: str = Depends(get_current_user),
):
    """Execute the complete 6-stage one-shot jobseeker application pipeline."""
    from app.services.one_shot_engine import execute_one_shot_pipeline
    try:
        res = await execute_one_shot_pipeline(payload, user_id=_user_id)
        return res.dict()
    except Exception as exc:
        from app.services.answer_bank_store import AnswerBankStoreUnavailable
        if isinstance(exc, AnswerBankStoreUnavailable):
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        logger.error("one-shot pipeline execution failed: %s", exc)
        raise HTTPException(status_code=500, detail="One-shot pipeline execution failed") from exc


@app.post("/api/v1/ats/simulate")
async def ats_simulate_endpoint(payload: dict):
    """Run the explicit development ATS fixture; never expose it as live analysis."""
    app_env = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
    demo_enabled = os.getenv("ENABLE_DEMO_FIXTURES", "false").strip().lower() in {"1", "true", "yes", "on"}
    if app_env in {"production", "prod", "staging"} or not demo_enabled:
        raise HTTPException(
            status_code=423,
            detail={
                "code": "disabled_by_launch_scope",
                "capability": "demo.ats_simulator",
                "message": "The ATS simulator is available only when explicit demo fixtures are enabled in development.",
            },
        )
    from app.services.ats_simulator import simulate_ats_parsing
    resume_text = payload.get("resume_text", "")
    return {
        "evidence_class": "demo_fixture",
        "runtime_mode": "development_demo",
        **simulate_ats_parsing(resume_text),
    }


@app.post("/api/v1/interview/copilot-hint")
async def interview_copilot_hint_endpoint(payload: dict):
    """Generate real-time STAR response hints during live interview."""
    from app.services.live_interview_copilot import CopilotHintRequest, generate_interview_hint
    req = CopilotHintRequest(**payload)
    try:
        res = await generate_interview_hint(req)
    except LLMNotConfiguredError as exc:
        logger.error("interview/copilot-hint: LLM not configured: %s", exc)
        raise HTTPException(status_code=503, detail="ai_service_unavailable") from exc
    return res.dict()


@app.get("/api/v1/candidate/answers")
async def candidate_answers_endpoint(
    application_id: Optional[str] = Query(None),
    _user_id: str = Depends(get_current_user),
):
    """Retrieve only the authenticated user's versioned answer snapshot."""
    from app.services.answer_bank_store import (
        AnswerBankStoreUnavailable,
        load_candidate_answer_snapshot,
    )
    try:
        snapshot = await load_candidate_answer_snapshot(
            _user_id,
            application_id=application_id,
        )
    except AnswerBankStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return snapshot.dict()


@app.put("/api/v1/candidate/answers")
async def candidate_answers_save_endpoint(
    payload: CandidateAnswerSaveRequest,
    _user_id: str = Depends(get_current_user),
):
    """Create a new owner-scoped answer version after explicit user save."""
    from app.services.answer_bank_store import (
        AnswerBankStoreUnavailable,
        save_candidate_answer_snapshot,
    )
    try:
        snapshot = await save_candidate_answer_snapshot(
            _user_id,
            payload.answers,
            application_id=payload.application_id,
            confirm_sensitive=payload.confirm_sensitive,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AnswerBankStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return snapshot.dict()



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
async def match_candidate_bank_endpoint(
    payload: dict,
    user_id: str = Depends(get_current_user),
):
    """Match an ATS form label against the caller's persisted answer bank."""
    from app.services.answer_bank_store import (
        AnswerBankStoreUnavailable,
        load_candidate_answer_snapshot,
    )
    from app.services.candidate_answer_bank import CandidateAnswers, match_question_to_answer

    question = payload.get("question_text", "")
    application_id = payload.get("application_id")
    custom_qa = payload.get("custom_qa", {})
    try:
        snapshot = await load_candidate_answer_snapshot(user_id, application_id=application_id)
    except AnswerBankStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    bank = CandidateAnswers(**snapshot.answers, custom_qa=custom_qa)
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


class InternalRuntimePurgeRequest(BaseModel):
    user_id: str


@app.post("/api/v1/internal/account/purge")
async def internal_account_runtime_purge(
    payload: InternalRuntimePurgeRequest,
    request: Request,
):
    """Purge runtime-only user state; callable only by the Go service boundary."""
    import hmac
    from uuid import UUID

    expected = os.getenv("AI_INTERNAL_TOKEN", "")
    supplied = request.headers.get("X-Internal-Token", "")
    if not expected or not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Internal service authentication required")
    try:
        user_id = str(UUID(payload.user_id))
    except (ValueError, AttributeError) as exc:
        raise HTTPException(status_code=422, detail="user_id must be a UUID") from exc

    from app.services.browser_automation.session import _SESSIONS, cancel_run
    from app.services.db import get_pool
    from app.services.privacy_ledger import ledger

    errors: list[str] = []
    revoked = 0
    screenshot_paths: list[str] = []
    run_ids: list[str] = []
    pool = await get_pool()
    if pool is not None:
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT run_id, celery_task_id FROM agent_runs WHERE user_id = $1::uuid",
                    user_id,
                )
                run_ids = [str(row["run_id"]) for row in rows]
                task_ids = [str(row["celery_task_id"]) for row in rows if row["celery_task_id"]]
                receipts = await conn.fetch(
                    "SELECT screenshot_path FROM submission_receipts WHERE user_id = $1::uuid AND screenshot_path IS NOT NULL LIMIT 1000",
                    user_id,
                )
                screenshot_paths = [str(row["screenshot_path"]) for row in receipts]
            if task_ids:
                from app.celery_app import celery_app
                for task_id in task_ids:
                    celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
                    revoked += 1
        except Exception as exc:  # noqa: BLE001 - report incomplete purge to caller
            errors.append(f"worker/runtime lookup failed: {exc}")

    for session in list(_SESSIONS.values()):
        if session.owner_id == user_id:
            try:
                await asyncio.wait_for(cancel_run(session.run_id, user_id), timeout=5.0)
            except Exception as exc:  # noqa: BLE001 - continue all cleanup targets
                errors.append(f"browser session {session.run_id}: {exc}")

    for path in screenshot_paths:
        try:
            if path and os.path.isfile(path):
                os.remove(path)
        except OSError as exc:
            errors.append(f"screenshot cleanup failed: {exc}")

    try:
        from app.services import automation_engine
        for run_id in run_ids:
            automation_engine._autopilot_store.pop(run_id, None)
            automation_engine._persisted_runs.discard(run_id)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"process-local run cleanup failed: {exc}")

    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            from redis.asyncio import Redis
            redis = Redis.from_url(redis_url, decode_responses=True)
            keys = []
            async for key in redis.scan_iter(match=f"tayari:op-budget:*:*{user_id}:*"):
                keys.append(key)
            if keys:
                await redis.delete(*keys)
            await redis.aclose()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Redis cleanup failed: {exc}")

    try:
        await ledger.clear_user_log(user_id)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"privacy ledger cleanup failed: {exc}")

    if errors and os.getenv("ENV", "development").lower() == "production":
        raise HTTPException(status_code=503, detail="Runtime purge incomplete; account deletion was not started")
    return {"status": "purged", "revoked_tasks": revoked, "browser_runs": len(run_ids), "errors": errors}


# ---------------------------------------------------------------------------
# Plugin registration (backward compat)
# ---------------------------------------------------------------------------

from app.plugins import register_plugins  # noqa: E402



register_plugins(app)

if __name__ == "__main__":
    import uvicorn  # noqa: E402

    # Containers must listen on all interfaces by default; operators can
    # narrow the bind with BIND_HOST for local or host-network deployments.
    bind_host = os.getenv("BIND_HOST", "0.0.0.0")  # nosec B104 - container listener is explicitly configurable
    uvicorn.run(app, host=bind_host, port=int(os.getenv("PORT", "8000")))
