"""
Total Compensation & Offer Calculator Engine.
Calculates annualized True Net Present Value (NPV) of job offers considering Base Salary,
Bonus, RSU/Option Vesting Schedules, 401(k) Match, and Cost-of-Living (COL) adjustments.
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class JobOfferInput(BaseModel):
    offer_id: Optional[str] = "offer_1"
    company_name: str
    job_title: str
    location: str = "Remote"
    base_salary: float = Field(ge=0, description="Annual base salary in USD")
    annual_bonus_pct: float = Field(default=10.0, ge=0, description="Target bonus percentage")
    signing_bonus: float = Field(default=0.0, ge=0, description="One-time signing bonus")
    equity_total_value: float = Field(default=0.0, ge=0, description="Total equity grant dollar value")
    equity_vesting_years: int = Field(default=4, ge=1, description="Vesting period in years")
    stock_growth_annual_pct: float = Field(default=5.0, description="Expected annual stock growth %")
    match_401k_pct: float = Field(default=4.0, ge=0, description="401k company match %")
    col_index: float = Field(default=100.0, ge=1, description="Cost of Living index (100 = baseline)")


class OfferAnalysisResult(BaseModel):
    offer_id: str
    company_name: str
    job_title: str
    year_1_total_comp: float
    annualized_4yr_npv: float
    real_purchasing_power_comp: float
    breakdown: Dict[str, float]
    recommendation_notes: List[str]


def calculate_offer_comp(offer: JobOfferInput, baseline_col_index: float = 100.0) -> OfferAnalysisResult:
    """
    Calculate annualized total comp breakdown and COL-adjusted real purchasing power.
    """
    annual_bonus = offer.base_salary * (offer.annual_bonus_pct / 100.0)
    annual_equity_base = offer.equity_total_value / offer.equity_vesting_years
    annual_401k = offer.base_salary * (offer.match_401k_pct / 100.0)
    
    # Year 1 Comp includes signing bonus
    year_1_total = offer.base_salary + annual_bonus + offer.signing_bonus + annual_equity_base + annual_401k
    
    # Annualized 4-Year NPV with stock growth assumption
    growth_multiplier = (1 + (offer.stock_growth_annual_pct / 100.0)) ** 2  # avg 2 yr growth
    annualized_4yr = offer.base_salary + annual_bonus + (annual_equity_base * growth_multiplier) + annual_401k

    # COL Adjustment
    col_factor = baseline_col_index / max(1.0, offer.col_index)
    real_purchasing_power = annualized_4yr * col_factor

    notes: List[str] = []
    if offer.signing_bonus > 0:
        notes.append(f"Includes ${offer.signing_bonus:,.0f} one-time signing bonus in Year 1.")
    if offer.equity_total_value > 0:
        notes.append(f"Equity grant vests over {offer.equity_vesting_years} years (${annual_equity_base:,.0f}/yr base).")
    if offer.col_index > 120:
        notes.append(f"High Cost-of-Living area (COL Index {offer.col_index}). Real purchasing power is adjusted to ${real_purchasing_power:,.0f}.")

    return OfferAnalysisResult(
        offer_id=offer.offer_id or "offer_1",
        company_name=offer.company_name,
        job_title=offer.job_title,
        year_1_total_comp=round(year_1_total, 2),
        annualized_4yr_npv=round(annualized_4yr, 2),
        real_purchasing_power_comp=round(real_purchasing_power, 2),
        breakdown={
            "base_salary": round(offer.base_salary, 2),
            "annual_bonus": round(annual_bonus, 2),
            "signing_bonus": round(offer.signing_bonus, 2),
            "annual_equity": round(annual_equity_base, 2),
            "annual_401k": round(annual_401k, 2)
        },
        recommendation_notes=notes
    )
