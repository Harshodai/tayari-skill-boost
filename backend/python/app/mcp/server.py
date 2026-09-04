"""
Native Production FastMCP Server for Tayari AI Engine.
Exposes typed FastMCP tools backed by Pydantic models.
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional, Literal
from pydantic import BaseModel, Field

from app.schemas import (
    CoverLetterInput,
    CommunicationInput,
    InterviewPrepInput,
    KnowledgeGraphInput,
)
from app.services.optimizer import optimize_with_reflection
from app.services.ats_engine import heuristic_ats_score
from app.guardrails.truth_gate import verify_resume_truthfulness
from app.services.interview_ai import InterviewPrepGenerator
from app.services.cover_letter import CoverLetterGenerator
from app.services.communication import CommunicationGenerator
from app.services.linkedin_analyzer import score_linkedin_profile
from app.ai_proofing.detector import AIProofingDetector
from app.services.knowledge_graph import KnowledgeGraphExtractor
from app.services.offer_calculator import calculate_offer_comp, JobOfferInput

logger = logging.getLogger(__name__)

try:
    from mcp.server.fastmcp import FastMCP
    mcp = FastMCP(
        "Tayari Native Python AI Engine MCP",
        instructions=(
            "Native FastMCP Server for Tayari AI Platform. "
            "Allows AI agents (Cursor, Claude Desktop, Ollama) to execute typed tools for job search, "
            "resume optimization, ATS scoring, truth checks, cover letter generation, interview prep, "
            "communication drafting, LinkedIn profile scoring, AI proofing detection, knowledge graph extraction, "
            "offer calculation, skill gap analysis, and market demand intelligence."
        )
    )

    tool_decorator = mcp.tool
except ImportError:
    mcp = None
    def tool_decorator():
        def wrapper(fn):
            return fn
        return wrapper


# --- Pydantic Tool Input Schemas ---

class SearchJobsInput(BaseModel):
    query: str = Field(..., description="Job query keywords (e.g. 'Senior Python Engineer')")
    location: str = Field("Remote", description="Job location")
    limit: int = Field(10, ge=1, le=50, description="Max number of job results to return")


class OptimizeResumeInput(BaseModel):
    resume_text: str = Field(..., description="The original resume text to optimize")
    job_description: str = Field(..., description="The target job description")


class ATSCheckInput(BaseModel):
    resume_text: str = Field(..., description="Resume text to score")
    job_description: str = Field(..., description="Job description text")


class TruthCheckInput(BaseModel):
    original_text: str = Field(..., description="Original candidate resume text")
    optimized_text: str = Field(..., description="AI-optimized resume text to verify")


class LinkedInAnalysisInput(BaseModel):
    profile_text: str = Field(..., description="Raw text of the LinkedIn profile")


class AIProofingInput(BaseModel):
    text: str = Field(..., description="Resume or cover letter text to audit for AI-generated patterns")


class SkillGapInput(BaseModel):
    resume_text: str = Field(..., description="Candidate resume text")
    job_description: str = Field("", description="Target job description (optional)")
    target_role: str = Field("", description="Target job title / role name (optional)")


class MarketDemandInput(BaseModel):
    role: str = Field(..., description="Target role name (e.g. 'Backend Engineer')")
    location: Optional[str] = Field(None, description="Location filter (e.g. 'Remote', 'London')")


# --- FastMCP Tool Definitions ---


@tool_decorator()
async def search_jobs(params: SearchJobsInput) -> Dict[str, Any]:
    """Search aggregated job boards and AI-rank results against profile."""
    from app.services.job_agent import smart_search
    res = await smart_search(query=params.query, location=params.location, profile=None, resume_text=None)
    all_jobs = res.get("jobs", [])
    sliced_jobs = all_jobs[:params.limit]
    return {
        "jobs": sliced_jobs,
        "count": len(sliced_jobs),
        "total_count": len(all_jobs),
    }


@tool_decorator()
async def optimize_resume(params: OptimizeResumeInput) -> Dict[str, Any]:
    """Run Tayari's reflective optimizer loop on a resume against a job description."""
    return await optimize_with_reflection(params.resume_text, params.job_description)


@tool_decorator()
async def check_ats_score(params: ATSCheckInput) -> Dict[str, Any]:
    """Calculate deterministic ATS score, keyword coverage matrix, and formatting risks."""
    return heuristic_ats_score(params.resume_text, params.job_description)


@tool_decorator()
async def check_truth_guardrails(params: TruthCheckInput) -> Dict[str, Any]:
    """Run Tayari truth-gate guardrails to detect keyword stuffing or fabricated facts."""
    res = verify_resume_truthfulness(params.original_text, params.optimized_text)
    return res.model_dump()


@tool_decorator()
async def generate_interview_prep(params: InterviewPrepInput) -> Dict[str, Any]:
    """Generate STAR and technical interview questions based on candidate experience."""
    return await InterviewPrepGenerator.generate(
        resume_text=params.resume_text,
        job_title=params.job_title,
        company_name=params.company_name,
        interview_type=params.interview_type,
    )


@tool_decorator()
async def generate_cover_letter(params: CoverLetterInput) -> Dict[str, Any]:
    """Generate a tailored, high-converting cover letter based on candidate resume and job description."""
    return await CoverLetterGenerator.generate(
        resume_text=params.resume_text,
        job_description=params.job_description,
        company_name=params.company_name,
        job_title=params.job_title,
        tone=params.tone,
        personal_notes=params.personal_notes,
    )


@tool_decorator()
async def generate_communication(params: CommunicationInput) -> Dict[str, Any]:
    """Generate follow-up, thank-you, status check, or negotiation emails with Voice DNA guardrails."""
    return await CommunicationGenerator.generate(
        comm_type=params.comm_type,
        resume_text=params.resume_text,
        job_title=params.job_title,
        company_name=params.company_name,
        recipient_name=params.recipient_name,
        discussion_points=params.discussion_points,
        offer_details=params.offer_details,
        days_since=params.days_since,
    )


@tool_decorator()
async def analyze_linkedin_profile(params: LinkedInAnalysisInput) -> Dict[str, Any]:
    """Analyze and score LinkedIn profile text for recruiter searchability and impact."""
    return await score_linkedin_profile(params.profile_text)


@tool_decorator()
async def detect_ai_proofing(params: AIProofingInput) -> Dict[str, Any]:
    """Audit text for AI buzzwords, repetitive transitions, and risk of AI detection."""
    detector = AIProofingDetector()
    analysis = detector.analyze(params.text)
    return analysis.model_dump()


@tool_decorator()
async def extract_knowledge_graph(params: KnowledgeGraphInput) -> Dict[str, Any]:
    """Extract structured skills, timeline, achievements, and entities from candidate resume."""
    return await KnowledgeGraphExtractor.extract(params.resume_text)


@tool_decorator()
async def calculate_offer_compensation(params: JobOfferInput) -> Dict[str, Any]:
    """Calculate annualized Total Compensation, 4-year NPV, and Cost-of-Living adjusted purchasing power."""
    res = calculate_offer_comp(params)
    return res.model_dump()


@tool_decorator()
async def analyze_skill_gap(params: SkillGapInput) -> Dict[str, Any]:
    """Analyze skill gaps between candidate resume and job requirements/target roles using ESCO taxonomy."""
    from app.services.skill_gap_analyzer import SkillGapAnalyzer
    return SkillGapAnalyzer.analyze_gap(
        resume_text=params.resume_text,
        job_description=params.job_description,
        target_role=params.target_role,
    )


@tool_decorator()
async def get_role_market_demand(params: MarketDemandInput) -> Dict[str, Any]:
    """Fetch real live role-demand signals and job counts for a role across verified job platforms."""
    from app.services.market_intelligence import get_role_demand
    return await get_role_demand(role_title=params.role, location=params.location)



if __name__ == "__main__":
    if mcp:
        mcp.run()
