"""Recruiter Cold Outreach Copilot — Tayari Python layer.

All generated company intelligence fields are hypotheses derived from company name alone.
They MUST be marked with provenance='unverified_hypothesis' and MUST NOT be presented
as verified facts without external confirmation.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

from pydantic import BaseModel, Field

from app.services.llm_service import llm_json, LLMNotConfiguredError

logger = logging.getLogger(__name__)


class RecruiterOutreachDraft(BaseModel):
    cold_email_subject: str = Field(min_length=1, max_length=140)
    cold_email_body: str = Field(min_length=1, max_length=1500)
    linkedin_note: str = Field(min_length=1, max_length=280)
    followup_bump: str = Field(min_length=1, max_length=500)


async def generate_recruiter_outreach(
    recruiter_name: str,
    company: str,
    target_role: str,
    candidate_proof_points: str,
) -> Dict[str, Any]:
    """Generate cold outreach email and LinkedIn connection request."""
    rec_name = recruiter_name.strip() or "Hiring Manager"
    comp = company.strip() or "Target Company"
    role = target_role.strip() or "Software Engineer"
    proof = candidate_proof_points.strip() or "Built high-throughput backend services handling 10M+ daily events."

    system_prompt = (
        "You are an expert executive cold email copywriter. "
        "Write concise, highly compelling, non-spammy outreach messages to hiring managers. "
        "Ground every claim strictly in the candidate proof point provided — never invent "
        "experience, metrics, or shared history the candidate did not state."
    )

    user_prompt = f"""Write cold outreach for a candidate reaching out to {rec_name} at {comp} for a {role} position.
Candidate Proof Point: {proof}

Provide:
1. Cold Email (Subject + 3 concise paragraphs under 120 words total + low friction CTA).
2. LinkedIn Connection Note (strictly under 280 characters).
3. 5-Day Follow-Up Bump Email (under 50 words).
"""

    # ponytail: this used to call the LLM, discard the real response into an
    # unused "ai_raw" field, and always serve identical hardcoded templates as
    # the actual cold_email/linkedin_note/followup_bump — a candidate clicking
    # "Open in Gmail" (RecruiterOutreach.tsx) sent the exact same generic email
    # regardless of their real background. No LLM configured -> no draft, ever.
    try:
        draft = await llm_json(system_prompt, user_prompt, response_model=RecruiterOutreachDraft, max_tokens=600)
    except LLMNotConfiguredError:
        return {
            "company": comp,
            "role": role,
            "recruiter_name": rec_name,
            "llm_available": False,
            "predicted_emails": _predicted_emails(rec_name, comp),
            "cold_email": None,
            "linkedin_note": None,
            "followup_bump": None,
        }

    return {
        "company": comp,
        "role": role,
        "recruiter_name": rec_name,
        "llm_available": True,
        "predicted_emails": _predicted_emails(rec_name, comp),
        "cold_email": {
            "subject": draft.cold_email_subject,
            "body": draft.cold_email_body,
        },
        "linkedin_note": draft.linkedin_note,
        "followup_bump": draft.followup_bump,
    }


def _predicted_emails(rec_name: str, comp: str) -> list[str]:
    """Common-format email guesses, explicitly labeled as predictions, never claimed as verified."""
    first_name = rec_name.split()[0].lower() if rec_name else "hiring.manager"
    last_name = rec_name.split()[-1].lower() if len(rec_name.split()) > 1 else ""
    domain = comp.lower().replace(" ", "").replace(",", "").replace(".", "") + ".com"

    return [
        f"{first_name}.{last_name}@{domain}" if last_name else f"{first_name}@{domain}",
        f"{first_name}@{domain}",
        f"{first_name[0]}{last_name}@{domain}" if last_name else f"{first_name}1@{domain}",
        f"recruiting@{domain}",
        f"careers@{domain}"
    ]


def generate_company_brief(company: str, domain: str = "") -> Dict[str, Any]:
    """Generate grounded company brief with provenance and structured source links (WP-16)."""
    clean_comp = company.strip()
    clean_dom = domain.strip().lower() or "unknown"
    return {
        "company_name": clean_comp,
        "domain": clean_dom,
        "provenance": "hypothetical",
        "verified": False,
        "description": {
            "value": f"{clean_comp} builds modern technological infrastructure and software solutions.",
            "provenance": "hypothetical",
            "verified": False,
        },
        "size_estimate": {
            "value": "50-250 employees",
            "provenance": "hypothetical",
            "verified": False,
        },
        "culture_signals": {
            "value": ["Engineering-led", "Distributed-first", "Rapid delivery cycles"],
            "provenance": "hypothetical",
            "verified": False,
        },
        "recent_news": [],
        "source_urls": [],
    }


def generate_contact_hypotheses(company: str, target_role: str = "") -> list[Dict[str, Any]]:
    """Generate labeled decision-maker hypotheses with verification links (WP-16)."""
    clean_comp = company.strip()
    encoded_comp = quote_plus(clean_comp)
    return [
        {
            "name_hypothesis": f"Head of Engineering / Director ({clean_comp})",
            "title_hypothesis": f"Engineering Leadership for {target_role or 'Software Teams'}",
            "confidence": "medium",
            "basis": "Standard executive structure pattern for technology teams",
            "provenance": "unverified_hypothesis",
            "verify_url": f"https://www.google.com/search?q={encoded_comp}+engineering+director+linkedin",
        },
        {
            "name_hypothesis": f"Lead Technical Recruiter ({clean_comp})",
            "title_hypothesis": "Technical Talent Acquisition",
            "confidence": "low",
            "basis": "Inferred from public job posting contact recommendations",
            "provenance": "unverified_hypothesis",
            "verify_url": f"https://www.google.com/search?q={encoded_comp}+technical+recruiter+linkedin",
        },
    ]


def check_recent_outreach_duplicate(past_outreach: list[Dict[str, Any]], company: str, recipient: str) -> bool:
    """Detect if outreach to the same company/recipient occurred within past 30 days (WP-16)."""
    comp_norm = company.strip().lower()
    rec_norm = recipient.strip().lower()
    for item in past_outreach:
        if (
            str(item.get("company", "")).strip().lower() == comp_norm
            or str(item.get("recipient", "")).strip().lower() == rec_norm
        ):
            days_ago = item.get("days_ago", 0)
            if days_ago <= 30:
                return True
    return False
