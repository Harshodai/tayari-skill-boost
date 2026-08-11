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

    # Text-only ghost signals that do not depend on posting metadata
    # (days_posted / is_reposted), so the screener still fires on a fresh
    # scrape that carries only title + description. These map directly to
    # the documented ghost signals (audit P2 #15 / Flow 3): confidential
    # employer, urgency cues with no deadline, implausibly wide salary
    # bands, and the absence of a requirements/qualifications section.
    CONFIDENTIAL_PHRASES = [
        "confidential company",
        "confidential employer",
        "confidential firm",
        "a confidential",
    ]
    URGENCY_PHRASES = [
        "urgent hire",
        "urgent hiring",
        "immediate hire",
        "hire immediately",
        "apply now",
        "apply asap",
        "asap",
        "immediate start",
    ]
    REQUIREMENTS_SECTION_HINTS = [
        "requirements",
        "qualifications",
        "must have",
        "you have",
        "you'll need",
        "we're looking for",
        "what you'll do",
    ]

    @staticmethod
    def _detect_wide_salary_range(desc_lower: str) -> bool:
        """Flag an implausibly wide salary band, e.g. '$40k to $140k' or '$40,000-$140,000'.

        A >3x spread between the floor and ceiling is a known ghost signal:
        the recruiter can point at any candidate and say 'you're in range'.
        """
        import re
        amounts: List[float] = []
        for match in re.finditer(r"\$?\s*(\d{1,3}(?:[,\d]{0,9}))\s*(?:k|000)?", desc_lower):
            raw = match.group(1).replace(",", "")
            try:
                val = float(raw)
            except ValueError:
                continue
            if "k" in desc_lower[match.start():match.end() + 1]:
                val *= 1000
            if val >= 30000:
                amounts.append(val)
        if len(amounts) < 2:
            return False
        lo, hi = min(amounts), max(amounts)
        return hi >= lo * 3 and hi - lo >= 50000

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

        confidential_hits = [p for p in LegitimacyChecker.CONFIDENTIAL_PHRASES if p in desc_lower]
        if confidential_hits:
            risk_score += 20.0
            risk_factors.append("Confidential / unnamed employer")

        urgency_hits = [p for p in LegitimacyChecker.URGENCY_PHRASES if p in desc_lower]
        if urgency_hits:
            risk_score += 15.0
            risk_factors.append("Urgency cue with no deadline")

        if LegitimacyChecker._detect_wide_salary_range(desc_lower):
            risk_score += 15.0
            risk_factors.append("Implausibly wide salary range")

        has_requirements = any(h in desc_lower for h in LegitimacyChecker.REQUIREMENTS_SECTION_HINTS)
        if not has_requirements and len(description.strip()) >= 200:
            risk_score += 10.0
            risk_factors.append("No requirements / qualifications section")

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
