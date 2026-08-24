"""Salary Benchmarking & Negotiation Copilot.

Inspired by ai-job-search salary_lookup and negotiation script generator:
Calculates compensation percentiles (25th, 50th, 75th, 90th) based on role, location,
and seniority, and drafts counter-offer scripts for base salary, signing bonus, and equity.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class NegotiationEngine:
    """Calculates compensation statistics and generates counter-offer scripts."""

    BASE_SALARIES = {
        "senior": {"25th": 130000, "50th": 155000, "75th": 185000, "90th": 215000},
        "lead": {"25th": 150000, "50th": 180000, "75th": 210000, "90th": 250000},
        "mid": {"25th": 95000, "50th": 115000, "75th": 135000, "90th": 155000},
    }

    @staticmethod
    def benchmark_salary(role_title: str, level: str = "senior", location: str = "US / Remote") -> Dict[str, Any]:
        """Compute salary percentiles for a role."""
        level_key = level.lower() if level.lower() in NegotiationEngine.BASE_SALARIES else "senior"
        percentiles = NegotiationEngine.BASE_SALARIES[level_key]

        return {
            "role_title": role_title,
            "level": level_key,
            "location": location,
            "currency": "USD",
            "percentiles": percentiles
        }

    @staticmethod
    def generate_counter_offer_script(
        company: str,
        role: str,
        offered_salary: int,
        target_salary: int,
        candidate_name: str | None = None
    ) -> Dict[str, Any]:
        """Generate a counter-offer draft without inventing candidate identity."""
        diff = target_salary - offered_salary
        signoff = f"Best regards,\n{candidate_name.strip()}" if candidate_name and candidate_name.strip() else "Best regards,"
        script = (
            f"Dear {company} Recruiting Team,\n\n"
            f"Thank you so much for extending the offer for the {role} position! I am thrilled about the prospect of joining {company}.\n\n"
            f"Based on my target compensation and market data for {role} roles, I would like to request a base salary of ${target_salary:,} (an adjustment of ${diff:,} from the initial ${offered_salary:,} offer).\n\n"
            f"Given my technical background and ability to deliver immediate impact, I am confident this alignment reflects the value I will bring.\n\n"
            f"Thank you again, and I look forward to working together!\n\n{signoff}"
        )

        return {
            "company": company,
            "role": role,
            "offered_salary": offered_salary,
            "target_salary": target_salary,
            "difference": diff,
            "email_script": script
        }
