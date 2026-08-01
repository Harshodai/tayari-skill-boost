"""Job Posting Legitimacy & Ghost Job Risk Detector (Schema Based).

Computes Ghost Job Risk Score (0-100%) based on Pydantic schema validation,
posting staleness, boilerplate token ratio, and repeated reposting signals.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class LegitimacyAssessmentSchema(BaseModel):
    """Pydantic schema for job posting legitimacy evaluation."""
    title: str = Field(...)
    days_posted: int = Field(0, ge=0)
    ghost_job_risk_score: float = Field(..., ge=0.0, le=100.0)
    is_ghost_job_risk: bool = Field(...)
    risk_factors: List[str] = Field(default_factory=list)
    recommendation: str = Field(...)


class LegitimacyChecker:
    """Schema-based job posting legitimacy and ghost job risk evaluator."""

    BOILERPLATE_TERMS = [
        "fast-paced environment",
        "self-starter",
        "wear many hats",
        "competitive salary",
        "team player",
        "dynamic team"
    ]

    @staticmethod
    def evaluate_posting_legitimacy(
        title: str,
        description: str,
        days_posted: int = 0,
        is_reposted: bool = False
    ) -> Dict[str, Any]:
        """Compute Ghost Job Risk Score using Pydantic schema validation."""
        risk_score = 0.0
        risk_factors: List[str] = []

        if days_posted >= 45:
            risk_score += 40.0
            risk_factors.append(f"Posting is stale ({days_posted} days old)")
        elif days_posted >= 30:
            risk_score += 20.0
            risk_factors.append(f"Posting is aging ({days_posted} days old)")

        if is_reposted:
            risk_score += 25.0
            risk_factors.append("Job has been repeatedly reposted")

        desc_lower = description.lower()
        bp_matches = [term for term in LegitimacyChecker.BOILERPLATE_TERMS if term in desc_lower]
        if len(bp_matches) >= 3:
            risk_score += 20.0
            risk_factors.append("High boilerplate text ratio detected")

        if len(description.strip()) < 200:
            risk_score += 15.0
            risk_factors.append("Vague or unusually short job description")

        risk_score = min(risk_score, 100.0)
        is_ghost_job = risk_score >= 50.0

        assessment = LegitimacyAssessmentSchema(
            title=title,
            days_posted=days_posted,
            ghost_job_risk_score=risk_score,
            is_ghost_job_risk=is_ghost_job,
            risk_factors=risk_factors,
            recommendation="High ghost job risk — proceed with caution or verify company contact" if is_ghost_job else "Legitimate posting"
        )
        return assessment.model_dump() if hasattr(assessment, "model_dump") else assessment.dict()
