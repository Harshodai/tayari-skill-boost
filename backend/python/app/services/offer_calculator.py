"""Multi-Offer & Financial Compensation Calculator Service — Tayari AI Engine.

Evaluates multi-offer packages (base salary, sign-on bonus, annual bonus %,
RSU equity vesting schedules, estimated state tax, and cost-of-living index)
and generates tailored counter-offer negotiation scripts.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class OfferDetails(BaseModel):
    company: str
    location: str
    base_salary: float
    signing_bonus: float = 0.0
    annual_target_bonus_pct: float = 0.0
    total_rsu_value: float = 0.0
    rsu_vesting_years: float = 4.0
    estimated_tax_rate_pct: float = 28.0
    cost_of_living_index: float = 100.0  # Baseline 100 (e.g. SF = 180, Austin = 110)


class OfferComparisonResult(BaseModel):
    company: str
    year_1_total_compensation: float
    annual_recurring_compensation: float
    effective_post_tax_compensation: float
    col_adjusted_compensation: float
    equity_per_year: float
    rating_score: float
    counter_offer_script: str


def generate_counter_offer_script(company: str, target_tc: float, current_tc: float) -> str:
    """Generate professional counter-offer email script using non-confrontational anchor leverage."""
    delta = max(target_tc - current_tc, 15000.0)
    return (
        f"Subject: {company} Offer — Compensation Discussion & Next Steps\n\n"
        f"Hi [Recruiter Name],\n\n"
        f"Thank you so much for extending the offer to join {company} as [Role Title]! "
        f"I am thrilled about the vision and the team's engineering goals.\n\n"
        f"I have reviewed the details of the compensation package (${current_tc:,.0f} Year 1 Total Comp). "
        f"Based on market data for senior candidates with specialized expertise in high-concurrency systems, "
        f"and competing conversations in my pipeline, I am hoping we can bring the Year 1 Total Compensation closer to ${target_tc:,.0f} "
        f"(or an additional ${delta:,.0f} in signing bonus / equity allocation).\n\n"
        f"If we can reach this target, I would be excited to sign the offer immediately and begin onboarding.\n\n"
        f"Looking forward to hearing your thoughts!\n\n"
        f"Best regards,\n[Your Name]"
    )


def calculate_offer_financials(offer: OfferDetails) -> OfferComparisonResult:
    """Calculate normalized annual financial metrics for a single job offer."""
    equity_per_year = offer.total_rsu_value / max(offer.rsu_vesting_years, 1.0)
    target_bonus_amount = offer.base_salary * (offer.annual_target_bonus_pct / 100.0)

    # Year 1 includes signing bonus
    year_1_tc = offer.base_salary + offer.signing_bonus + target_bonus_amount + equity_per_year
    # Recurring annual
    recurring_tc = offer.base_salary + target_bonus_amount + equity_per_year

    tax_factor = 1.0 - (offer.estimated_tax_rate_pct / 100.0)
    post_tax_tc = year_1_tc * tax_factor

    col_factor = 100.0 / max(offer.cost_of_living_index, 50.0)
    col_adjusted_tc = post_tax_tc * col_factor

    rating = min(100.0, (col_adjusted_tc / 150000.0) * 80.0)
    counter_script = generate_counter_offer_script(offer.company, year_1_tc * 1.12, year_1_tc)

    return OfferComparisonResult(
        company=offer.company,
        year_1_total_compensation=round(year_1_tc, 2),
        annual_recurring_compensation=round(recurring_tc, 2),
        effective_post_tax_compensation=round(post_tax_tc, 2),
        col_adjusted_compensation=round(col_adjusted_tc, 2),
        equity_per_year=round(equity_per_year, 2),
        rating_score=round(rating, 1),
        counter_offer_script=counter_script,
    )


def compare_multiple_offers(offers: List[OfferDetails]) -> List[OfferComparisonResult]:
    """Compare a list of job offers sorted by COL-adjusted compensation."""
    results = [calculate_offer_financials(o) for o in offers]
    results.sort(key=lambda x: x.col_adjusted_compensation, reverse=True)
    return results
