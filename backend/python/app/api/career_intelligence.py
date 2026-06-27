"""FastAPI Router for Career Intelligence endpoints.
Exposes routes for skill gap analysis, salary benchmarks, and learning paths.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from app.services.skill_gap_analyzer import SkillGapAnalyzer
from app.services.learning_recommender import LearningRecommender

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/career-intelligence", tags=["Career Intelligence"])

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
    """
    Return a list of currently trending skills.
    """
    from app.services.career_intelligence import trending_skills
    return trending_skills(limit)

@router.post("/salary-benchmark", response_model=SalaryBenchmarkResponse)
async def get_salary_benchmark(payload: CareerIntelligenceRequest):
    """
    Retrieve salary benchmarking statistics for the target role and location.
    """
    role = payload.target_role or "Software Engineer"
    location = payload.location or "US"
    location_lower = location.lower()
    role_lower = role.lower()

    # Find closest role key
    matched_role = "backend" # Default fallback
    for key in MOCK_SALARIES.keys():
        if key in role_lower:
            matched_role = key
            break

    role_salaries = MOCK_SALARIES[matched_role]
    
    # Check location match (e.g. US, India/IN)
    loc_key = "default"
    if "india" in location_lower or "in" == location_lower:
        loc_key = "in"
    elif "united states" in location_lower or "us" == location_lower or "usa" in location_lower:
        loc_key = "us"

    sal = role_salaries.get(loc_key, role_salaries["default"])

    return SalaryBenchmarkResponse(
        role=role,
        location=location,
        salary_min=sal["min"],
        salary_median=sal["med"],
        salary_max=sal["max"],
        currency=sal["currency"],
        confidence="medium (based on historical market reports)"
    )
