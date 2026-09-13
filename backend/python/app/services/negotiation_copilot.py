"""Salary & Counter-Offer Negotiation Copilot — Tayari AI Engine.

Uses H1B compensation benchmark data and negotiation frameworks (5R) to generate:
- Target compensation benchmarks by role, level, and metro area
- 3 strategic counter-offer response emails
- Verbal phone call negotiation scripts
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.services.llm_service import llm_json, LLMNotConfiguredError

logger = logging.getLogger(__name__)


class NegotiationDraft(BaseModel):
    warm_appreciation_email: str = Field(min_length=1, max_length=2000)
    data_backed_email: str = Field(min_length=1, max_length=2000)
    verbal_script: str = Field(min_length=1, max_length=1500)


# H1B & Industry Compensation Benchmark Data Baseline
BENCHMARK_SALARIES = {
    "software engineer": {"base": 145000, "equity": 35000, "sign_on": 15000},
    "senior software engineer": {"base": 185000, "equity": 65000, "sign_on": 25000},
    "staff software engineer": {"base": 230000, "equity": 120000, "sign_on": 40000},
    "product manager": {"base": 155000, "equity": 40000, "sign_on": 15000},
    "senior product manager": {"base": 195000, "equity": 75000, "sign_on": 25000},
    "data scientist": {"base": 150000, "equity": 35000, "sign_on": 15000},
    "engineering manager": {"base": 210000, "equity": 90000, "sign_on": 30000},
}


@dataclass
class NegotiationPackage:
    target_role: str
    current_offer_base: float
    current_offer_equity: float
    current_offer_signon: float
    competing_offer_base: float = 0.0
    location: str = "San Francisco, CA"
    target_counter_base: float = 0.0
    target_counter_equity: float = 0.0
    counter_emails: Dict[str, str] = field(default_factory=dict)
    verbal_script: str = ""


async def generate_negotiation_strategy(
    role: str,
    company: str,
    base_offer: float,
    equity_offer: float = 0.0,
    signon_offer: float = 0.0,
    competing_offer: float = 0.0,
    location: str = "San Francisco, CA",
) -> Dict[str, Any]:
    """Generate salary benchmarks and 3-tier counter-offer strategy."""
    role_key = role.lower().strip()
    benchmark = BENCHMARK_SALARIES.get(role_key, {"base": 160000, "equity": 40000, "sign_on": 20000})

    # Calculate recommended counter targets (10-18% above initial offer)
    target_base = round(max(base_offer * 1.12, benchmark["base"] * 1.05), -3)
    target_equity = round(max(equity_offer * 1.15, benchmark["equity"]), -3)

    system_prompt = (
        "You are an elite executive salary negotiation coach. "
        "Draft professional, respectful, data-backed counter-offer emails and phone scripts."
    )

    user_prompt = f"""Draft a 3-stage negotiation package for a candidate offered a role at {company}.
Role: {role}
Current Offer: Base ${base_offer:,.0f}, Equity ${equity_offer:,.0f}, Sign-on ${signon_offer:,.0f}
Target Counter: Base ${target_base:,.0f}, Equity ${target_equity:,.0f}
Competing Offer: ${competing_offer:,.0f} if > 0
Location: {location}

Provide:
1. Warm Appreciation & Soft Counter Email
2. Data-Backed High-Impact Counter Email (citing market data)
3. Word-for-word Verbal Phone Call Negotiation Script
"""

    base_response: Dict[str, Any] = {
        "company": company,
        "role": role,
        "current_offer": {
            "base": base_offer,
            "equity": equity_offer,
            "signon": signon_offer,
            "total_first_year": base_offer + equity_offer + signon_offer,
        },
        "market_benchmark": benchmark,
        "recommended_counter": {
            "base": target_base,
            "equity": target_equity,
            "total_first_year": target_base + target_equity + signon_offer,
        },
    }

    # ponytail: this used to call the LLM, discard the real response into an
    # unused "ai_guidance" field, and always serve identical hardcoded
    # negotiation emails/script as the actual output — the "elite negotiation
    # coach" persona in the prompt never actually wrote what the candidate
    # sent. The dollar amounts above are real (computed from the candidate's
    # own offer + a static benchmark table) and stay outside the LLM call;
    # only the persuasive prose is LLM-authored, and only served when real.
    try:
        draft = await llm_json(system_prompt, user_prompt, response_model=NegotiationDraft, max_tokens=1200)
    except LLMNotConfiguredError:
        return {
            **base_response,
            "llm_available": False,
            "emails": None,
            "verbal_script": None,
        }

    return {
        **base_response,
        "llm_available": True,
        "emails": {
            "warm_appreciation": draft.warm_appreciation_email,
            "data_backed": draft.data_backed_email,
        },
        "verbal_script": draft.verbal_script,
    }
