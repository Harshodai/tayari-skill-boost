import logging
import os
import urllib.parse
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

from app.agent.agent_engine import GeneralistAgentEngine, _is_safe_url
from app.agent.job_seeker_agent import JobSeekerAgentEngine
from app.agent.autonomous_career_engine import AutonomousCareerEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/agent", tags=["agent"])

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
    job_urls: List[str]
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
job_seeker_engine = JobSeekerAgentEngine()
career_engine = AutonomousCareerEngine()

def _validate_job_url(url: str):
    if not _is_safe_url(url):
        raise HTTPException(status_code=400, detail=f"Invalid or unsafe URL '{url}'. Private, loopback, or non-HTTP(S) destinations are forbidden.")

@router.post("/run")
async def run_agent_task(req: AgentRunRequest) -> Dict[str, Any]:
    try:
        workspace_dir = os.path.abspath("./workspace")
        os.makedirs(workspace_dir, exist_ok=True)
        async with GeneralistAgentEngine(workspace_path=workspace_dir) as engine:
            result = await engine.execute_task(goal=req.goal, max_steps=req.max_steps or 10)
            return {"success": True, "data": result}
    except Exception as e:
        logger.exception("Agent run error")
        raise HTTPException(status_code=500, detail="Agent execution failed.")

@router.get("/tools")
async def list_agent_tools() -> Dict[str, Any]:
    return {
        "success": True,
        "mcp_tools": agent_instance.mcp.list_tools(),
        "mcp_resources": agent_instance.mcp.list_resources()
    }

# --- Job Seeker Endpoints ---

@router.post("/job-seeker/search")
async def job_seeker_search(req: JobSearchRequest) -> Dict[str, Any]:
    try:
        res = await job_seeker_engine.search_and_filter_jobs(req.query, req.location or "Remote")
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker search error")
        raise HTTPException(status_code=500, detail="Job search failed.")

@router.post("/job-seeker/tailor")
async def job_seeker_tailor(req: JobTailorRequest) -> Dict[str, Any]:
    try:
        res = await job_seeker_engine.tailor_resume_and_cover_letter(req.job_title, req.company, req.job_description)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker tailor error")
        raise HTTPException(status_code=500, detail="Resume tailoring failed.")

@router.post("/job-seeker/autofill")
async def job_seeker_autofill(req: JobAutofillRequest) -> Dict[str, Any]:
    if not _is_safe_url(req.form_url):
        raise HTTPException(status_code=400, detail=f"Invalid or unsafe URL '{req.form_url}'. Private, loopback, or non-HTTP(S) destinations are forbidden.")
    try:
        profile = req.user_profile or {"name": "Candidate", "email": "user@example.com"}
        res = await job_seeker_engine.auto_fill_application_form(req.form_url, profile)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker autofill error")
        raise HTTPException(status_code=500, detail="Application auto-fill failed.")

@router.post("/job-seeker/interview-prep")
async def job_seeker_interview_prep(req: JobInterviewPrepRequest) -> Dict[str, Any]:
    try:
        res = await job_seeker_engine.generate_interview_prep_brief(req.company)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Job seeker interview prep error")
        raise HTTPException(status_code=500, detail="Interview prep generation failed.")

# --- Executive Career Engine Endpoints ---

@router.post("/career/email-sync")
async def sync_emails() -> Dict[str, Any]:
    try:
        res = await career_engine.scan_and_sync_email_invites()
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Email sync error")
        raise HTTPException(status_code=500, detail="Email sync failed.")

@router.get("/career/interview-board")
async def get_interview_board() -> Dict[str, Any]:
    try:
        res = career_engine.interview_board.get_kanban_board()
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Get interview board error")
        raise HTTPException(status_code=500, detail="Failed to fetch interview board.")

@router.post("/career/interview-board/update")
async def update_interview_card(req: UpdateKanbanRequest) -> Dict[str, Any]:
    try:
        res = career_engine.interview_board.update_card_stage(req.card_id, req.new_stage)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Update interview card error")
        raise HTTPException(status_code=500, detail="Failed to update interview stage.")

@router.post("/career/ats-prepare")
async def ats_prepare(req: ATSPrepareRequest) -> Dict[str, Any]:
    try:
        res = await career_engine.prepare_ats_keyword_optimization_hitl(req.resume_text, req.job_description)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("ATS prepare error")
        raise HTTPException(status_code=500, detail="ATS preparation failed.")

@router.post("/career/ats-confirm")
async def ats_confirm(req: ATSConfirmRequest) -> Dict[str, Any]:
    try:
        res = await career_engine.confirm_ats_keyword_optimization_hitl(req.approval_id, req.approved, req.custom_keywords)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("ATS confirm error")
        raise HTTPException(status_code=500, detail="ATS confirmation failed.")

@router.post("/career/universal-apply")
async def universal_apply(req: UniversalApplyRequest) -> Dict[str, Any]:
    try:
        if not req.candidate_profile:
            raise HTTPException(status_code=400, detail="Missing candidate_profile in request.")
        for url in req.job_urls:
            _validate_job_url(url)
        res = await career_engine.universal_batch_auto_apply(req.job_urls, req.candidate_profile)
        return {"success": True, "data": res}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Universal apply error")
        raise HTTPException(status_code=500, detail="Batch auto-apply failed.")

@router.post("/career/ai-negotiate")
async def ai_negotiate(req: AINegotiateRequest) -> Dict[str, Any]:
    try:
        res = await career_engine.generate_ai_salary_negotiation(req.current_offer, req.target_role, req.location, req.company)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("AI negotiate error")
        raise HTTPException(status_code=500, detail="Salary negotiation analysis failed.")

@router.post("/career/outreach")
async def outreach(req: OutreachRequest) -> Dict[str, Any]:
    try:
        res = await career_engine.generate_recruiter_cold_outreach(req.company, req.recruiter_name, req.job_title)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Recruiter outreach error")
        raise HTTPException(status_code=500, detail="Recruiter outreach generation failed.")

@router.post("/career/copilot")
async def copilot(req: CopilotRequest) -> Dict[str, Any]:
    try:
        res = await career_engine.generate_interview_copilot_response(req.question, req.role)
        return {"success": True, "data": res}
    except Exception as e:
        logger.exception("Copilot response error")
        raise HTTPException(status_code=500, detail="Copilot response generation failed.")
