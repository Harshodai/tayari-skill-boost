"""FastAPI Router for Career Intelligence endpoints.
Exposes routes for skill gap analysis, salary benchmarks, and learning paths.
"""
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
import logging

from app.auth.dependencies import get_current_user
from app.services.db import get_pool
from app.services.skill_gap_analyzer import SkillGapAnalyzer
from app.services.learning_recommender import LearningRecommender

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/career-intelligence", tags=["Career Intelligence"])
career_router = APIRouter(prefix="/api/v1/career", tags=["Career Decision Queue"])

ActionStatusBadge = Literal["verified", "candidate_confirmed", "inferred", "illustrative", "unavailable"]

class CareerAction(BaseModel):
    model_config = ConfigDict(extra='allow')
    action_id: str
    type: str
    title: str
    why_now: str
    effort_estimate_mins: int
    confidence: float
    status_badge: ActionStatusBadge
    freshness_ts: str
    required_action_by_candidate: str
    evidence_url: Optional[str] = None

class NextActionsResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    actions: List[CareerAction] = Field(default_factory=list)

class CareerIntelligenceRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None
    target_role: Optional[str] = None
    location: Optional[str] = ""

class SalaryBenchmarkResponse(BaseModel):
    role: str
    location: str
    salary_min: float
    salary_median: float
    salary_max: float
    currency: str
    confidence: str

# Mock salary intelligence registry based on common roles and locations
MOCK_SALARIES: Dict[str, Dict[str, Dict[str, Any]]] = {
    "frontend": {
        "us": {"min": 85000, "med": 115000, "max": 160000, "currency": "USD"},
        "in": {"min": 600000, "med": 1200000, "max": 2400000, "currency": "INR"},
        "default": {"min": 80000, "med": 110000, "max": 150000, "currency": "USD"}
    },
    "backend": {
        "us": {"min": 95000, "med": 130000, "max": 185000, "currency": "USD"},
        "in": {"min": 800000, "med": 1500000, "max": 3000000, "currency": "INR"},
        "default": {"min": 90000, "med": 125000, "max": 170000, "currency": "USD"}
    },
    "fullstack": {
        "us": {"min": 90000, "med": 125000, "max": 175000, "currency": "USD"},
        "in": {"min": 700000, "med": 1400000, "max": 2800000, "currency": "INR"},
        "default": {"min": 85000, "med": 120000, "max": 165000, "currency": "USD"}
    },
    "devops": {
        "us": {"min": 100000, "med": 140000, "max": 195000, "currency": "USD"},
        "in": {"min": 900000, "med": 1800000, "max": 3500000, "currency": "INR"},
        "default": {"min": 95000, "med": 135000, "max": 180000, "currency": "USD"}
    },
    "data science": {
        "us": {"min": 105000, "med": 145000, "max": 200000, "currency": "USD"},
        "in": {"min": 1000000, "med": 2000000, "max": 4000000, "currency": "INR"},
        "default": {"min": 100000, "med": 140000, "max": 190000, "currency": "USD"}
    },
    "product manager": {
        "us": {"min": 95000, "med": 135000, "max": 180000, "currency": "USD"},
        "in": {"min": 1200000, "med": 2200000, "max": 4500000, "currency": "INR"},
        "default": {"min": 90000, "med": 130000, "max": 170000, "currency": "USD"}
    }
}

@router.post("/skills-gap")
async def get_skills_gap(payload: CareerIntelligenceRequest):
    """
    Perform a skills gap analysis between user resume and required job description or target role.
    """
    try:
        result = SkillGapAnalyzer.analyze_gap(
            resume_text=payload.resume_text,
            job_description=payload.job_description or "",
            target_role=payload.target_role or ""
        )
        return result
    except Exception as e:
        logger.error(f"Error in skills-gap analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze skills gap: {str(e)}")

@router.post("/learning-path")
async def get_learning_path(payload: CareerIntelligenceRequest):
    """
    Generate learning resources based on the user's missing skills.
    """
    try:
        # First get missing skills via gap analyzer
        gap_result = SkillGapAnalyzer.analyze_gap(
            resume_text=payload.resume_text,
            job_description=payload.job_description or "",
            target_role=payload.target_role or ""
        )
        missing_skills = gap_result.get("missing_skills", [])
        
        # Get learning paths
        recommendations = LearningRecommender.get_recommendations(missing_skills)
        return {"recommendations": recommendations}
    except Exception as e:
        logger.error(f"Error generating learning path: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate learning path: {str(e)}")

@router.get("/trending-skills")
async def get_trending_skills(limit: int = 10):
    """Return live trends only; an explicitly labelled fixture is development-only."""
    import os

    app_env = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
    demo_enabled = os.getenv("ENABLE_DEMO_FIXTURES", "false").strip().lower() in {"1", "true", "yes", "on"}
    if app_env not in {"production", "prod", "staging"} and demo_enabled:
        from app.services.career_intelligence import trending_skills

        return [
            {**item, "evidence_class": "demo_fixture", "runtime_mode": "development_demo"}
            for item in trending_skills(limit)
        ]
    raise HTTPException(
        status_code=503,
        detail={
            "code": "provider_not_configured",
            "capability": "workspace.career_intelligence.trending_skills",
            "message": "Live trend data is not configured for this deployment.",
        },
    )

@router.post("/salary-benchmark", response_model=SalaryBenchmarkResponse)
async def get_salary_benchmark(payload: CareerIntelligenceRequest):
    """
    Retrieve salary benchmarking statistics for the target role and location.
    """
    role = payload.target_role or "Software Engineer"
    location = payload.location or "US"
    location_lower = location.lower()
    role_lower = role.lower()

    import httpx
    import os

    # Use a real compensation API or scraped data
    LEVELS_FYI_API = os.getenv("LEVELS_FYI_API_URL", "")

    if LEVELS_FYI_API:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{LEVELS_FYI_API}/salaries",
                    params={"role": role, "location": location}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and "salary_min" in data:
                        return SalaryBenchmarkResponse(
                            role=role,
                            location=location,
                            salary_min=data.get("salary_min", 0.0),
                            salary_median=data.get("salary_median", 0.0),
                            salary_max=data.get("salary_max", 0.0),
                            currency=data.get("currency", "USD"),
                            confidence=data.get("confidence", "high (external API)")
                        )
        except Exception as exc:
            logger.warning("External salary API failed: %s", exc)

    raise HTTPException(
        status_code=503,
        detail={
            "code": "provider_unavailable",
            "capability": "workspace.career_intelligence.salary_benchmark",
            "message": "Live salary data is unavailable; no static estimate is returned.",
        },
    )


async def _generate_career_actions(user_id: str) -> List[CareerAction]:
    """Generate ranked candidate-specific next actions from verified database state."""
    actions: List[CareerAction] = []
    pool = await get_pool()
    resumes = []
    applications = []
    portals = []
    approvals = []
    db_error = False

    if pool:
        try:
            async with pool.acquire() as conn:

                try:
                    resumes = await conn.fetch(
                        "SELECT id, title, original_text, status, updated_at FROM public.resumes WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5",
                        user_id,
                    )
                except Exception as e:
                    db_error = True
                    logger.debug("Could not fetch resumes for next-actions: %s", e)

                try:
                    applications = await conn.fetch(
                        "SELECT id, application_id, job, status, updated_at FROM public.applications WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10",
                        user_id,
                    )
                except Exception as e:
                    db_error = True
                    logger.debug("Could not fetch applications for next-actions: %s", e)

                try:
                    portals = await conn.fetch(
                        "SELECT id, name, careers_url, enabled, updated_at FROM public.user_portals WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5",
                        user_id,
                    )
                except Exception as e:
                    db_error = True
                    logger.debug("Could not fetch user_portals for next-actions: %s", e)

                try:
                    approvals = await conn.fetch(
                        "SELECT id, action_type, status, created_at FROM public.agent_action_approvals WHERE candidate_id = $1 AND status = 'PENDING' ORDER BY created_at DESC LIMIT 5",
                        user_id,
                    )
                except Exception as e:
                    db_error = True
                    logger.debug("Could not fetch approvals for next-actions: %s", e)
        except Exception as exc:
            db_error = True
            logger.warning("DB error querying next-actions for %s: %s", user_id, exc)

    now_iso = datetime.now(timezone.utc).isoformat()

    # If the DB was unavailable and no data was retrieved, surface an explicit unavailable action
    # rather than an empty list, which would silently hide the service degradation.
    if not resumes and not applications and not portals and not approvals and db_error:
        return [
            CareerAction(
                action_id="act-db-unavailable",
                type="system",
                title="Career intelligence temporarily unavailable",
                why_now="Database connectivity issue prevented retrieval of your profile data.",
                effort_estimate_mins=0,
                confidence=0.0,
                status_badge="unavailable",
                freshness_ts=now_iso,
                required_action_by_candidate="Retry in a few minutes.",
                evidence_url=None,
            )
        ]

    # If no data at all, return empty list (truthful empty state)
    if not resumes and not applications and not portals and not approvals:
        return []

    # 1. Pending Human-In-The-Loop Approvals
    for apprv in approvals:
        actions.append(
            CareerAction(
                action_id=f"act-apprv-{apprv['id']}",
                type="approval",
                title=f"Review pending application submission ({apprv.get('action_type', 'Application')})",
                why_now="Human-in-the-loop review is mandatory before submission boundary to ensure zero hallucinated claims.",
                effort_estimate_mins=3,
                confidence=0.98,
                status_badge="verified",
                freshness_ts=now_iso,
                required_action_by_candidate="Review application payload and confirm submission",
                evidence_url="/approvals",
            )
        )

    # 2. Application Follow-ups
    for app_item in applications:
        status_val = (app_item.get("status") or "").lower()
        # ponytail: company/role live in the job JSONB column (no company/role columns exist); parse defensively.
        _job = app_item.get("job") or {}
        if isinstance(_job, str):
            try:
                import json as _json
                _job = _json.loads(_job)
            except Exception:
                _job = {}
        if not isinstance(_job, dict):
            _job = {}
        company = _job.get("company") or "target company"
        role = _job.get("role") or _job.get("title") or "open role"
        app_id = app_item.get("application_id") or str(app_item.get("id"))

        if status_val in ["applied", "submitted", "in_review", ""]:
            actions.append(
                CareerAction(
                    action_id=f"act-followup-{app_id}",
                    type="followup",
                    title=f"Follow up on application at {company} ({role})",
                    why_now="Timely recruiter follow-ups sent within 5-7 days double the rate of interview progression.",
                    effort_estimate_mins=5,
                    confidence=0.92,
                    status_badge="candidate_confirmed",
                    freshness_ts=now_iso,
                    required_action_by_candidate="Review AI-generated follow-up note and send via email/LinkedIn",
                    evidence_url="/career-ops?tab=followup",
                )
            )
        elif status_val in ["interview", "interviewing", "phone_screen"]:
            actions.append(
                CareerAction(
                    action_id=f"act-interview-{app_id}",
                    type="interview_prep",
                    title=f"Prepare STAR interview stories for {company}",
                    why_now="Targeted behavioral and technical preparation is the #1 predictor of final round offer success.",
                    effort_estimate_mins=20,
                    confidence=0.95,
                    status_badge="verified",
                    freshness_ts=now_iso,
                    required_action_by_candidate="Run mock practice session with AI interview copilot",
                    evidence_url="/interview/prep",
                )
            )

    # 3. Resume Tailoring & Optimization
    if resumes:
        latest_res = resumes[0]
        res_id = latest_res.get("id")
        res_title = latest_res.get("title") or "Current Resume"
        raw_text = latest_res.get("original_text") or ""
        metrics_found = len(re.findall(r"\d+\s*%|\$\s*\d|\d+[kKmM]\+?|\b\d{2,}\b", raw_text))

        actions.append(
            CareerAction(
                action_id=f"act-tailor-{res_id}",
                type="resume_optimization",
                title=f"Tailor '{res_title}' for upcoming applications",
                why_now="Role-specific tailoring lifts ATS semantic fit and recruiter pass-through by over 50%.",
                effort_estimate_mins=10,
                confidence=0.88,
                status_badge="inferred",
                freshness_ts=now_iso,
                required_action_by_candidate="Optimize resume against target job description with Reflexion loop",
                evidence_url=f"/resume/results?resumeId={res_id}",
            )
        )

        if metrics_found < 4:
            actions.append(
                CareerAction(
                    action_id=f"act-metrics-{res_id}",
                    type="quantification",
                    title="Quantify resume achievements with measurable impact",
                    why_now=f"Only {metrics_found} numerical metrics found. Resumes with 5+ quantified outcomes rank significantly higher.",
                    effort_estimate_mins=15,
                    confidence=0.85,
                    status_badge="inferred",
                    freshness_ts=now_iso,
                    required_action_by_candidate="Add specific metrics (e.g. % saved, latency reduction, users scaled)",
                    evidence_url="/resume/builder",
                )
            )

    # 4. Portal Scanner Action
    if portals:
        active_count = sum(1 for p in portals if p.get("enabled", True))
        actions.append(
            CareerAction(
                action_id="act-scan-portals",
                type="portal_scan",
                title=f"Scan {active_count} configured company career portals",
                why_now="Scanning directly uncovers unindexed openings before third-party job boards scrape them.",
                effort_estimate_mins=5,
                confidence=0.82,
                status_badge="inferred",
                freshness_ts=now_iso,
                required_action_by_candidate="Initiate automated scanner run for monitored portals",
                evidence_url="/career-ops?tab=scanner",
            )
        )
    elif resumes:
        actions.append(
            CareerAction(
                action_id="act-add-portals",
                type="portal_scan",
                title="Add target company career URLs to automated scanner",
                why_now="Early applicants within the first 24 hours of job posting have a 3x higher callback rate.",
                effort_estimate_mins=5,
                confidence=0.78,
                status_badge="inferred",
                freshness_ts=now_iso,
                required_action_by_candidate="Add 2-3 target company careers pages to the portal scanner",
                evidence_url="/career-ops?tab=scanner",
            )
        )

    # 5. Skill Calibration Action
    if resumes:
        actions.append(
            CareerAction(
                action_id="act-skill-calibration",
                type="skill_gap",
                title="Calibrate skills against trending market benchmarks",
                why_now="Verify your resume reflects current framework versions and high-demand cloud tooling.",
                effort_estimate_mins=15,
                confidence=0.76,
                status_badge="inferred",
                freshness_ts=now_iso,
                required_action_by_candidate="Review skills gap analysis and learning recommendations",
                evidence_url="/career-intelligence",
            )
        )

    # Rank by confidence descending, take up to 7 actions
    actions.sort(key=lambda x: x.confidence, reverse=True)
    return actions[:7]


@career_router.get("/next-actions", response_model=NextActionsResponse)
async def get_career_next_actions(user_id: str = Depends(get_current_user)):
    """Retrieve ranked candidate next actions for the Career Command Center."""
    actions = await _generate_career_actions(user_id)
    return NextActionsResponse(actions=actions)


@router.get("/next-actions", response_model=NextActionsResponse)
async def get_career_intel_next_actions(user_id: str = Depends(get_current_user)):
    """Alias for /api/v1/career/next-actions under the career-intelligence namespace."""
    actions = await _generate_career_actions(user_id)
    return NextActionsResponse(actions=actions)


class ScenarioPlanRequest(BaseModel):
    scenario: str = Field(default="role_change")
    skills: List[str] = Field(default_factory=list)
    current_title: Optional[str] = None
    target_role: Optional[str] = None


@career_router.post("/scenario-plan")
async def get_scenario_plan(req: ScenarioPlanRequest, _user_id: str = Depends(get_current_user)):
    """Generate deterministic scenario-based transition plan (WP-10)."""
    from fastapi import HTTPException as _HTTPException

    from app.services.scenario_planner import plan_scenario
    try:
        return plan_scenario(
            scenario_type=req.scenario,
            resume_skills=req.skills,
            current_title=req.current_title,
            target_role=req.target_role,
        )
    except ValueError as exc:
        raise _HTTPException(status_code=400, detail=str(exc)) from exc
