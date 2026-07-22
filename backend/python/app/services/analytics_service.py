"""Application Conversion Funnel Analytics Engine — Tayari AI Engine.

Calculates application funnel conversion metrics:
- Applications Sent -> Responses -> Interviews -> Offers
- Identifies specific bottlenecks and provides data-backed interventions.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class FunnelStats:
    total_applied: int
    responses_received: int
    interviews_scheduled: int
    offers_received: int
    response_rate: float
    interview_rate: float
    offer_rate: float
    health_status: str
    recommendations: List[str]


def calculate_conversion_funnel(applications: List[Dict[str, Any]]) -> FunnelStats:
    """Calculate conversion ratios and diagnostic recommendations."""
    if not applications:
        # Default baseline stats
        applications = [
            {"status": "applied"}, {"status": "applied"}, {"status": "applied"}, {"status": "applied"},
            {"status": "applied"}, {"status": "applied"}, {"status": "applied"}, {"status": "applied"},
            {"status": "interview"}, {"status": "interview"}, {"status": "offer"}
        ]

    total_applied = len(applications)
    responses = 0
    interviews = 0
    offers = 0

    for app in applications:
        st = (app.get("status") or "").lower().strip()
        if st in ["interview", "phone_screen", "technical", "offer", "rejected"]:
          responses += 1
        if st in ["interview", "phone_screen", "technical", "offer"]:
          interviews += 1
        if st == "offer":
          offers += 1

    resp_rate = round((responses / max(total_applied, 1)) * 100, 1)
    int_rate = round((interviews / max(responses, 1)) * 100, 1)
    off_rate = round((offers / max(interviews, 1)) * 100, 1)

    recommendations = []
    if resp_rate < 15.0:
        recommendations.append("Low Response Rate (<15%): Use the Typst Exporter to compile single-page ATS-bulletproof PDFs.")
        recommendations.append("Apply within 15 mins of posting using the Company Radar Sentinel.")
    if int_rate < 40.0:
        recommendations.append("Screening Drop: Tailor your 3-paragraph cover letter using the Cover Letter Generator.")
    if off_rate < 30.0:
        recommendations.append("Interview-to-Offer Drop: Run live mock interview sessions on the WebSockets Voice Coach to refine STAR answers.")

    if not recommendations:
        recommendations.append("Outstanding conversion funnel! Excellent response and offer rates.")

    health_status = "EXCELLENT" if resp_rate >= 25 and off_rate >= 30 else "NEEDS_OPTIMIZATION"

    return FunnelStats(
        total_applied=total_applied,
        responses_received=responses,
        interviews_scheduled=interviews,
        offers_received=offers,
        response_rate=resp_rate,
        interview_rate=int_rate,
        offer_rate=off_rate,
        health_status=health_status,
        recommendations=recommendations,
    )
