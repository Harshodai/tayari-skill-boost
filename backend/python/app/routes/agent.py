import hashlib
import logging
import os
import stat
import tempfile
import urllib.parse
import hashlib
from collections import OrderedDict
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

from app.agent.agent_engine import GeneralistAgentEngine, _is_safe_url
from app.agent.job_seeker_agent import JobSeekerAgentEngine
from app.agent.autonomous_career_engine import AutonomousCareerEngine
from app.auth.dependencies import get_current_user
from app.services.llm_service import LLMNotConfiguredError, routing_snapshot
from app.services.ai_orchestration import SUPPORTED_TIERS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/agent", tags=["agent"])

AGENT_WORKSPACE_BASE = os.getenv(
    "AGENT_WORKSPACE_DIR",
    os.path.join(tempfile.gettempdir(), "tayari-agent-workspace"),
)


def _ensure_workspace_base() -> None:
    """Prepare AGENT_WORKSPACE_BASE with restrictive permissions.

    Startup validation: the base must be a real directory owned by the current
    user and must not be a symlink (a link could redirect per-run workspaces to
    an attacker-chosen path). An existing invalid base raises PermissionError —
    failing fast is safer than silently running with a writable or foreign-owned
    directory. A missing base is created with 0o700.
    """
    if not os.path.exists(AGENT_WORKSPACE_BASE):
        os.makedirs(AGENT_WORKSPACE_BASE, mode=0o700, exist_ok=True)
        return

    st = os.lstat(AGENT_WORKSPACE_BASE)
    if stat.S_ISLNK(st.st_mode):
        raise PermissionError(f"AGENT_WORKSPACE_DIR {AGENT_WORKSPACE_BASE!r} must not be a symlink")
    if not stat.S_ISDIR(st.st_mode):
        raise PermissionError(f"AGENT_WORKSPACE_DIR {AGENT_WORKSPACE_BASE!r} is not a directory")
    if st.st_uid != os.getuid():
        raise PermissionError(f"AGENT_WORKSPACE_DIR {AGENT_WORKSPACE_BASE!r} must be owned by the current user")
    os.chmod(AGENT_WORKSPACE_BASE, 0o700)


# ponytail: validate the shared agent workspace base at import time so agent run
# directories are not readable by other system users and a symlinked or
# foreign-owned base cannot redirect runs elsewhere. An invalid base is a
# startup validation failure: log it clearly instead of letting a raw
# PermissionError escape at import and fail the whole app ambiguously.
try:
    _ensure_workspace_base()
except PermissionError as exc:
    logger.error("Startup validation failure: agent workspace base is invalid: %s", exc)

class AgentRunRequest(BaseModel):
    goal: str
    max_steps: Optional[int] = Field(10, ge=1, le=50)

# Job Seeker Requests
class JobSearchRequest(BaseModel):
    query: str
    location: Optional[str] = "Remote"

class JobTailorRequest(BaseModel):
    job_title: str
    company: str
    job_description: str

class JobAutofillRequest(BaseModel):
    form_url: str
    user_profile: Optional[Dict[str, Any]] = None

class JobInterviewPrepRequest(BaseModel):
    company: str

class EmailSyncRequest(BaseModel):
    email_account: Optional[str] = "user@example.com"

# Career Engine Requests
class ATSPrepareRequest(BaseModel):
    resume_text: str
    job_description: str

class ATSConfirmRequest(BaseModel):
    approval_id: str
    approved: bool
    custom_keywords: Optional[List[str]] = None

class UniversalApplyRequest(BaseModel):
    # ponytail: enforce a non-empty, bounded URL list so the universal apply flow
    # can never run with zero targets or exceed the engine's batch limit.
    job_urls: List[str] = Field(min_length=1, max_length=10)
    candidate_profile: Optional[Dict[str, Any]] = None

class AINegotiateRequest(BaseModel):
    current_offer: int
    target_role: str
    location: Optional[str] = "Remote"
    company: Optional[str] = "Target Company"

class OutreachRequest(BaseModel):
    company: str
    recruiter_name: str
    job_title: str

class ColdOutreachRequest(OutreachRequest):
    pass

class CopilotRequest(BaseModel):
    question: str
    role: str

class UpdateKanbanRequest(BaseModel):
    card_id: str
    new_stage: str

agent_instance = GeneralistAgentEngine()


def _require_legacy_job_seeker_fixture() -> None:
    """Keep the legacy simulated job-seeker engine out of release environments."""
    app_env = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
    enabled = os.getenv("ENABLE_LEGACY_JOB_SEEKER_FIXTURE", "false").strip().lower() in {"1", "true", "yes", "on"}
    if app_env in {"production", "prod", "staging"} or not enabled:
        raise HTTPException(
            status_code=423,
            detail={
                "code": "disabled_by_launch_scope",
                "capability": "demo.legacy_job_seeker_engine",
                "message": "The legacy job-seeker fixture is disabled; use the governed candidate workflow.",
            },
        )

# ponytail: bounded LRU caches for per-user engine instances. Engines hold
# in-memory state (HITL approvals, interview board), so keep them alive, but
# cap total resident instances to prevent unbounded memory growth.
_MAX_ENGINES_PER_KIND = 128
_career_engines: "OrderedDict[str, AutonomousCareerEngine]" = OrderedDict()
_job_seeker_engines: "OrderedDict[str, JobSeekerAgentEngine]" = OrderedDict()


def _get_or_create_engine(cache: "OrderedDict[str, Any]", user_id: str, factory) -> Any:
    """Refresh recency on hit; create + evict LRU when inserting beyond limit."""
    if user_id in cache:
        cache.move_to_end(user_id)
        return cache[user_id]

    engine = factory()
    cache[user_id] = engine
    if len(cache) > _MAX_ENGINES_PER_KIND:
        # ponytail: popitem(last=False) evicts the least-recently-used entry.
        cache.popitem(last=False)
    return engine


def _workspace_for(user_id: str) -> str:
    """Derive the per-user workspace directory inside AGENT_WORKSPACE_BASE.

    Mirrors run_agent_task's derivation: the JWT subject is untrusted input, so
    a filesystem-safe component is hashed from it instead of joined verbatim
    (it could contain separators or ".."). Creates the directory with
    restrictive permissions and returns its path.
    """
    safe_comp = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:32]
    workspace_dir = os.path.join(AGENT_WORKSPACE_BASE, safe_comp)
    os.makedirs(workspace_dir, exist_ok=True, mode=0o700)
    os.chmod(workspace_dir, 0o700)
    return workspace_dir


def _career_engine_for(user_id: str) -> AutonomousCareerEngine:
    """Per-user career engine so HITL approvals and the interview board stay scoped to one user."""
    return _get_or_create_engine(
        _career_engines,
        user_id,
        lambda: AutonomousCareerEngine(workspace_path=_workspace_for(user_id)),
    )


def _job_seeker_engine_for(user_id: str) -> JobSeekerAgentEngine:
    """Per-user job-seeker engine; state is scoped to the authenticated user."""
    return _get_or_create_engine(
        _job_seeker_engines,
        user_id,
        lambda: JobSeekerAgentEngine(workspace_path=_workspace_for(user_id)),
    )


def _clear_engine_for(user_id: str) -> None:
    """Remove both per-user engine cache entries explicitly."""
    _career_engines.pop(user_id, None)
    _job_seeker_engines.pop(user_id, None)

def _validate_job_url(url: str):
    if not _is_safe_url(url):
        raise HTTPException(status_code=400, detail=f"Invalid or unsafe URL '{url}'. Private, loopback, or non-HTTP(S) destinations are forbidden.")

@router.post("/run")
async def run_agent_task(req: AgentRunRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        # ponytail: run every agent task inside the secured workspace base that was
        # validated with 0o700 at module init, so per-task dirs inherit that policy.
        # The JWT subject is untrusted input, so a filesystem-safe component is
        # derived from it instead of joining it verbatim (it could contain
        # separators or "..").
        workspace_dir = _workspace_for(user_id)
        async with GeneralistAgentEngine(workspace_path=workspace_dir) as engine:
            result = await engine.execute_task(goal=req.goal, max_steps=req.max_steps or 10)
            return {"success": True, "data": result}
    except Exception as e:
        logger.exception("Agent run error")
        raise HTTPException(status_code=500, detail="Agent execution failed.")

@router.get("/runtime")
async def get_agent_runtime(user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Return safe runtime capabilities for the authenticated workspace.

    This is intentionally diagnostic rather than an execution endpoint. It
    exposes model-tier availability and bounded swarm policy without secrets,
    prompts, browser credentials, or claims that a provider is live when it is
    not configured.
    """
    return {
        "success": True,
        "data": {
            "model_routing": routing_snapshot(),
            "supported_tiers": list(SUPPORTED_TIERS),
            "swarm": {
                "enabled": True,
                "max_specialists": 12,
                "max_parallel": 6,
                "per_step_timeout_seconds": 600,
                "failure_isolation": True,
                "autonomous_sensitive_actions": False,
            },
            "memory": {
                "layers": ["working", "procedural", "episodic", "semantic"],
                "owner_scoped": True,
                "best_effort_degradation": True,
                "credentials_and_passwords": False,
            },
        },
    }


@router.get("/tools")
async def list_agent_tools(user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Expose runtime diagnostics without creating a second public MCP registry."""
    return {
        "success": True,
        "mcp_tools": agent_instance.mcp.list_public_tools(),
        "mcp_resources": [],
        "legacy_internal_tools": agent_instance.mcp.list_tools(),
        "canonical_mcp_endpoint": "supabase:function:mcp",
        "legacy_registry_public": False,
    }

# --- Job Seeker Endpoints ---

@router.post("/job-seeker/search")
async def job_seeker_search(req: JobSearchRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    _require_legacy_job_seeker_fixture()
    try:
        res = await _job_seeker_engine_for(user_id).search_and_filter_jobs(req.query, req.location or "Remote")
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker search error")
        raise HTTPException(status_code=500, detail="Job search failed.")

@router.post("/job-seeker/tailor")
async def job_seeker_tailor(req: JobTailorRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    _require_legacy_job_seeker_fixture()
    try:
        res = await _job_seeker_engine_for(user_id).tailor_resume_and_cover_letter(req.job_title, req.company, req.job_description)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker tailor error")
        raise HTTPException(status_code=500, detail="Resume tailoring failed.")

@router.post("/job-seeker/autofill")
async def job_seeker_autofill(req: JobAutofillRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    _require_legacy_job_seeker_fixture()
    if not _is_safe_url(req.form_url):
        raise HTTPException(status_code=400, detail=f"Invalid or unsafe URL '{req.form_url}'. Private, loopback, or non-HTTP(S) destinations are forbidden.")
    try:
        profile = req.user_profile or {"name": "Candidate", "email": "user@example.com"}
        res = await _job_seeker_engine_for(user_id).auto_fill_application_form(req.form_url, profile)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker autofill error")
        raise HTTPException(status_code=500, detail="Application auto-fill failed.")

@router.post("/job-seeker/interview-prep")
async def job_seeker_interview_prep(req: JobInterviewPrepRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    _require_legacy_job_seeker_fixture()
    try:
        res = await _job_seeker_engine_for(user_id).generate_interview_prep_brief(req.company)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker interview prep error")
        raise HTTPException(status_code=500, detail="Interview prep generation failed.")

# --- Executive Career Engine Endpoints ---

@router.post("/career/email-sync")
async def sync_emails(user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = await _career_engine_for(user_id).scan_and_sync_email_invites()
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Email sync error")
        raise HTTPException(status_code=500, detail="Email sync failed.")

@router.get("/career/interview-board")
async def get_interview_board(user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = _career_engine_for(user_id).interview_board.get_kanban_board()
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Get interview board error")
        raise HTTPException(status_code=500, detail="Failed to fetch interview board.")

@router.post("/career/interview-board/update")
async def update_interview_card(req: UpdateKanbanRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = _career_engine_for(user_id).interview_board.update_card_stage(req.card_id, req.new_stage)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Update interview card error")
        raise HTTPException(status_code=500, detail="Failed to update interview stage.")

@router.post("/career/ats-prepare")
async def ats_prepare(req: ATSPrepareRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = await _career_engine_for(user_id).prepare_ats_keyword_optimization_hitl(req.resume_text, req.job_description)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("ATS prepare error")
        raise HTTPException(status_code=500, detail="ATS preparation failed.")

@router.post("/career/ats-confirm")
async def ats_confirm(req: ATSConfirmRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = await _career_engine_for(user_id).confirm_ats_keyword_optimization_hitl(req.approval_id, req.approved, req.custom_keywords)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("ATS confirm error")
        raise HTTPException(status_code=500, detail="ATS confirmation failed.")

@router.post("/career/universal-apply")
async def universal_apply(req: UniversalApplyRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        if not req.candidate_profile:
            raise HTTPException(status_code=400, detail="Missing candidate_profile in request.")
        for url in req.job_urls:
            _validate_job_url(url)
        res = await _career_engine_for(user_id).universal_batch_auto_apply(req.job_urls, req.candidate_profile)
        return {"success": True, "data": res}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Universal apply error")
        raise HTTPException(status_code=500, detail="Batch auto-apply failed.")

@router.post("/career/ai-negotiate")
async def ai_negotiate(req: AINegotiateRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = await _career_engine_for(user_id).generate_ai_salary_negotiation(req.current_offer, req.target_role, req.location, req.company)
        return {"success": True, "data": res}
    except LLMNotConfiguredError as exc:
        logger.error("AI negotiate: LLM not configured/available: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except Exception as e:
        logger.exception("AI negotiate error")
        raise HTTPException(status_code=500, detail="Salary negotiation analysis failed.")

@router.post("/career/outreach")
async def outreach(req: OutreachRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = await _career_engine_for(user_id).generate_recruiter_cold_outreach(req.company, req.recruiter_name, req.job_title)
        return {"success": True, "data": res}
    except LLMNotConfiguredError as exc:
        logger.error("Recruiter outreach: LLM not configured/available: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except Exception as e:
        logger.exception("Recruiter outreach error")
        raise HTTPException(status_code=500, detail="Recruiter outreach generation failed.")

@router.post("/career/copilot")
async def copilot(req: CopilotRequest, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    try:
        res = await _career_engine_for(user_id).generate_interview_copilot_response(req.question, req.role)
        return {"success": True, "data": res}
    except LLMNotConfiguredError as exc:
        logger.error("Copilot response: LLM not configured/available: %s", exc)
        raise HTTPException(status_code=503, detail="ai_service_unavailable") from exc
    except Exception as e:
        logger.exception("Copilot response error")
        raise HTTPException(status_code=500, detail="Copilot response generation failed.")
