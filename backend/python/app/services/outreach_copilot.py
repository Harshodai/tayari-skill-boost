"""Recruiter Cold Outreach Copilot — Tayari AI Engine.

Generates hyper-personalized cold outreach emails and LinkedIn connection messages
tailored to hiring managers, recruiters, and engineering leads.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

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
