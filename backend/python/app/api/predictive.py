from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from app.services.predictive_scorer import PredictiveScorer
from app.services.bandit_service import BanditService

router = APIRouter(prefix="/api/v1/predictive", tags=["Predictive Funnel Analytics"])

class ScoreRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = ""

class VariantStat(BaseModel):
    variant_id: int
    pulls: int
    conversions: int

class BanditRequest(BaseModel):
    variants: List[VariantStat]

@router.post("/score")
async def get_predictive_score(payload: ScoreRequest):
    """
    Generate a multidimensional score for a resume variant text.
    """
    try:
        scores = PredictiveScorer.score_resume(
            resume_text=payload.resume_text,
            job_description=payload.job_description or ""
        )
        return scores
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate scores: {str(e)}")

@router.post("/bandit/select")
async def select_best_variant(payload: BanditRequest):
    """
    Applies Thompson Sampling to select a variant ID from stats.
    """
    if not payload.variants:
        raise HTTPException(status_code=400, detail="Variants list cannot be empty.")
    try:
        variants_dict = [v.model_dump() for v in payload.variants]
        selected_id = BanditService.select_variant(variants_dict)
        return {"selected_variant_id": selected_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Thompson Sampling selection failed: {str(e)}")
