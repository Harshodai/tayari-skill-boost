"""Career Trajectory & Promotion Milestone Predictor.

Inspired by ai-job-search promotion trajectory modeling:
Analyzes candidate experience history, title progressions, and project impact
to project next career promotion targets (Senior -> Staff / Lead) and target salary bands.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class CareerTrajectoryPredictor:
    """Predicts career progression milestones and target skill gaps."""

    SENIORITY_HIERARCHY = [
        "Junior Engineer",
        "Software Engineer",
        "Senior Engineer",
        "Staff Engineer",
        "Principal Engineer / Engineering Manager"
    ]

    @staticmethod
    def predict_next_milestone(current_title: str, years_experience: float) -> Dict[str, Any]:
        """Predict next target title milestone and recommended skill focus."""
        title_clean = current_title.strip()
        idx = 1  # Default to Software Engineer

        # iterate highest -> lowest so compound titles match their most senior level
        for i in range(len(CareerTrajectoryPredictor.SENIORITY_HIERARCHY) - 1, -1, -1):
            s = CareerTrajectoryPredictor.SENIORITY_HIERARCHY[i]
            if s.lower() in title_clean.lower():
                idx = i
                break

        next_idx = min(idx + 1, len(CareerTrajectoryPredictor.SENIORITY_HIERARCHY) - 1)
        next_title = CareerTrajectoryPredictor.SENIORITY_HIERARCHY[next_idx]

        # clamp scaled years to [0, 95] before rounding
        readiness_score = round(min(max((years_experience / 5.0) * 100, 0.0), 95.0), 1)

        return {
            "current_title": current_title,
            "years_experience": years_experience,
            "predicted_next_title": next_title,
            "promotion_readiness_score": readiness_score,
            "recommended_focus": [
                "System Architecture & Distributed Systems",
                "Cross-Team Technical Leadership",
                "Mentorship & Code Review Standards"
            ]
        }
