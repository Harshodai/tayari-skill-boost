"""
AI Engine core API routes for strategic analysis, optimizer, exports, cover letters, and copilot.
"""
import asyncio
import http.client
import ipaddress
import json
import logging
import re
import socket
import ssl
from html.parser import HTMLParser
from typing import Optional, List, Dict, Any, Union
from urllib.parse import urlsplit

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


class JobDescriptionImportRequest(BaseModel):
    url: str


MAX_IMPORTED_JOB_DESCRIPTION_BYTES = 1_000_000
JOB_DESCRIPTION_IMPORT_TIMEOUT_SECONDS = 5


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """TLS connection that dials a validated IP but verifies the URL hostname."""

    def __init__(self, connect_host: str, port: int, server_hostname: str, timeout: int) -> None:
        super().__init__(connect_host, port=port, timeout=timeout, context=ssl.create_default_context())
        self._server_hostname = server_hostname

    def connect(self) -> None:
        self.sock = self._create_connection((self.host, self.port), self.timeout, self.source_address)
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self._server_hostname)


class _ReadableTextExtractor(HTMLParser):
    """Small deterministic HTML-to-text extractor for public job posts."""

    _IGNORED_TAGS = {"script", "style", "noscript", "template", "svg", "canvas"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title: Optional[str] = None
        self._text: List[str] = []
        self._ignored_depth = 0
        self._in_title = False
        self._title_parts: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, Optional[str]]]) -> None:
        tag = tag.lower()
        if tag in self._IGNORED_TAGS:
            self._ignored_depth += 1
        elif tag == "title" and self._ignored_depth == 0:
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self._IGNORED_TAGS and self._ignored_depth:
            self._ignored_depth -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._ignored_depth:
            return
        if self._in_title:
            self._title_parts.append(data)
        self._text.append(data)

    def extracted(self) -> tuple[Optional[str], str]:
        normalize = lambda value: re.sub(r"\s+", " ", value).strip()
        title = normalize(" ".join(self._title_parts)) or None
        return title, normalize(" ".join(self._text))


def _is_unsafe_ip(address: Union[ipaddress.IPv4Address, ipaddress.IPv6Address]) -> bool:
    return (
        address.is_loopback
        or address.is_private
        or address.is_link_local
        or address.is_multicast
        or address.is_unspecified
        or address.is_reserved
        or not address.is_global
    )


def _resolve_public_addresses(hostname: str, port: int) -> List[str]:
    try:
        resolved = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=502, detail="Unable to resolve URL host") from exc
    addresses = sorted({item[4][0] for item in resolved})
    if not addresses:
        raise HTTPException(status_code=502, detail="Unable to resolve URL host")
    for raw_address in addresses:
        try:
            address = ipaddress.ip_address(raw_address)
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="URL host resolved to an invalid address") from exc
        if _is_unsafe_ip(address):
            raise HTTPException(status_code=400, detail="URL host is not publicly routable")
    return addresses


def _validate_public_url(value: str) -> str:
    url = value.strip()
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL must use http or https and include a hostname")
    if parsed.username is not None or parsed.password is not None:
        raise HTTPException(status_code=400, detail="URL credentials are not allowed")
    try:
        port = parsed.port
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="URL port is invalid") from exc
    if port is not None and not 0 < port < 65536:
        raise HTTPException(status_code=400, detail="URL port is invalid")

    try:
        literal_ip = ipaddress.ip_address(parsed.hostname)
    except ValueError:
        literal_ip = None
    if literal_ip is not None:
        if _is_unsafe_ip(literal_ip):
            raise HTTPException(status_code=400, detail="URL host is not publicly routable")
        return url

    _resolve_public_addresses(parsed.hostname, port or (443 if parsed.scheme == "https" else 80))
    return url


def _extract_imported_job_description(content_type: str, body: bytes) -> tuple[Optional[str], str]:
    media_type = content_type.split(";", 1)[0].strip().lower()
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="Job post content must be UTF-8 text") from exc

    if media_type == "text/plain":
        job_description = re.sub(r"\s+", " ", text).strip()
        title = None
    elif media_type in {"text/html", "application/xhtml+xml"}:
        parser = _ReadableTextExtractor()
        parser.feed(text)
        parser.close()
        title, job_description = parser.extracted()
    else:
        raise HTTPException(status_code=415, detail="Job post URL returned an unsupported content type")

    if len(re.sub(r"\s+", "", job_description)) < 50:
        raise HTTPException(status_code=422, detail="The page did not contain a useful job description")
    return title, job_description


def _fetch_public_job_description(url: str) -> tuple[Optional[str], str]:
    parsed = urlsplit(url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    addresses = _resolve_public_addresses(parsed.hostname or "", port)
    request_target = parsed.path or "/"
    if parsed.query:
        request_target = f"{request_target}?{parsed.query}"
    host_header = parsed.hostname or ""
    if parsed.port and parsed.port not in {80, 443}:
        host_header = f"{host_header}:{parsed.port}"
    headers = {
        "Accept": "text/html, text/plain",
        "Host": host_header,
        "User-Agent": "TayariJobDescriptionImporter/1.0",
    }

    last_error: Optional[Exception] = None
    for address in addresses:
        connection: Union[http.client.HTTPConnection, _PinnedHTTPSConnection]
        if parsed.scheme == "https":
            connection = _PinnedHTTPSConnection(address, port, parsed.hostname or "", JOB_DESCRIPTION_IMPORT_TIMEOUT_SECONDS)
        else:
            connection = http.client.HTTPConnection(address, port, timeout=JOB_DESCRIPTION_IMPORT_TIMEOUT_SECONDS)
        try:
            connection.request("GET", request_target, headers=headers)
            response = connection.getresponse()
            if 300 <= response.status < 400:
                raise HTTPException(status_code=400, detail="Redirects are not allowed for job-post imports")
            if response.status < 200 or response.status >= 300:
                raise HTTPException(status_code=502, detail="Unable to fetch the job post")
            content_type = response.getheader("Content-Type", "")
            if not content_type:
                raise HTTPException(status_code=415, detail="Job post URL did not provide a supported text content type")
            content_length = response.getheader("Content-Length")
            if content_length and content_length.isdigit() and int(content_length) > MAX_IMPORTED_JOB_DESCRIPTION_BYTES:
                raise HTTPException(status_code=413, detail="Job post content exceeds the import size limit")
            body = response.read(MAX_IMPORTED_JOB_DESCRIPTION_BYTES + 1)
            if len(body) > MAX_IMPORTED_JOB_DESCRIPTION_BYTES:
                raise HTTPException(status_code=413, detail="Job post content exceeds the import size limit")
            return _extract_imported_job_description(content_type, body)
        except HTTPException:
            raise
        except (OSError, TimeoutError, ssl.SSLError, http.client.HTTPException) as exc:
            last_error = exc
        finally:
            connection.close()

    raise HTTPException(status_code=502, detail="Unable to fetch the job post") from last_error


@router.post("/api/v1/job-descriptions/import")
async def import_job_description(payload: JobDescriptionImportRequest):
    """Retrieve a public, readable job post after strict SSRF validation."""
    safe_url = _validate_public_url(payload.url)
    title, job_description = await asyncio.to_thread(_fetch_public_job_description, safe_url)
    return {"url": safe_url, "title": title, "job_description": job_description}


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


class VerificationRequest(BaseModel):
    resume_text: str


@router.post("/api/v1/verification/submit")
async def submit_verification(payload: VerificationRequest):
    """V3 verified-human badge: truthfulness + screening scorers (stateless)."""
    from app.services.verification_service import run_verification
    try:
        result = await run_verification(payload.resume_text)
        return result
    except LLMNotConfiguredError as exc:
        logger.error("verification/submit: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("verification/submit failed: %s", exc)
        raise HTTPException(status_code=500, detail="Verification failed") from exc


class ReferralDraftContact(BaseModel):
    name: str
    title: Optional[str] = None
    company: Optional[str] = None
    relationship: str
    notes: Optional[str] = None


class ReferralDraftJob(BaseModel):
    title: str
    company: Optional[str] = None
    description: Optional[str] = None


class ReferralDraftUserContext(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    skills: List[str] = []


class ReferralDraftRequest(BaseModel):
    contact: ReferralDraftContact
    job: ReferralDraftJob
    user_context: Optional[ReferralDraftUserContext] = None


@router.post("/api/v1/referral/draft")
async def create_referral_draft(payload: ReferralDraftRequest):
    """Moat-1: personalize a referral-request draft for one contact (stateless)."""
    from app.services.referral_service import run_referral_draft
    try:
        verdict = await run_referral_draft(
            payload.contact.model_dump(),
            payload.job.model_dump(),
            (payload.user_context or ReferralDraftUserContext()).model_dump(),
        )
        return {
            "fit_score": verdict.fit_score,
            "subject": verdict.subject,
            "body": verdict.body,
            "rationale": verdict.rationale,
        }
    except LLMNotConfiguredError as exc:
        logger.error("referral/draft: LLM not configured: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("referral/draft failed: %s", exc)
        raise HTTPException(status_code=500, detail="Referral draft failed") from exc
