"""Moat-1 referral draft engine — personalized, honest referral-request drafts.

One LLM moderator grounds the draft in the contact's STATED relationship
(relationship/notes fields). The prompt forbids inventing shared history,
employers, or familiarity. Stateless by design: the Go gateway owns nothing
here beyond auth + validation, and the frontend persists drafts through the
existing Networking-page outreach flow.
"""
from typing import List, Optional

from pydantic import BaseModel, Field

from app.services.llm_service import llm_json


class ReferralDraftVerdict(BaseModel):
    fit_score: float = Field(ge=0, le=100, description="0-100 how well this contact fits a referral ask")
    subject: str = Field(min_length=1, max_length=140)
    email_body: str = Field(min_length=1, max_length=2000)
    linkedin_body: str = Field(min_length=1, max_length=1000)
    rationale: str = Field(min_length=1, max_length=500)


KIND_BRIEFS = {
    "intro": "a first-touch introduction that earns a reply, not a favour",
    "referral": "a polite, low-pressure referral request that makes it easy to say yes or no",
    "followup": "a single short follow-up that adds one new piece of value",
    "thanks": "a short thank-you that keeps the relationship warm",
}

_DRAFT_SYSTEM = (
    "You write personalized outreach messages for job applicants. "
    "GROUNDING RULES: the contact record's 'relationship' and 'notes' fields are "
    "the ONLY allowed source of shared history — never invent prior employers, "
    "co-working, familiarity, or inside knowledge. If the relationship says "
    "nothing specific, keep the ask warm and generic. The applicant's 'proof_points' "
    "are the ONLY allowed claims about their work. "
    "Return BOTH an email body (at most two short paragraphs) and a LinkedIn "
    "message body (one short paragraph), one subject of at most 10 words, and a "
    "fit_score reflecting how naturally this contact can give an honest referral."
)


async def run_referral_draft(
    contact: dict,
    job: dict,
    user_context: dict,
    kind: str = "referral",
) -> ReferralDraftVerdict:
    """Personalize a referral ask for one contact. Raises ValueError on missing anchors."""
    contact_name = (contact.get("name") or "").strip()
    relationship = (contact.get("relationship") or "").strip()
    job_title = (job.get("title") or "").strip()
    if not contact_name:
        raise ValueError("contact.name is required")
    if not relationship:
        raise ValueError("contact.relationship is required (the honesty anchor)")
    if not job_title:
        raise ValueError("job.title is required")
    if kind not in KIND_BRIEFS:
        raise ValueError("kind must be one of: intro, referral, followup, thanks")

    prompt_context = {
        "kind": kind,
        "kind_brief": KIND_BRIEFS[kind],
        "contact": {
            "name": contact_name,
            "title": (contact.get("title") or "").strip(),
            "company": (contact.get("company") or "").strip(),
            "relationship": relationship,
            "notes": (contact.get("notes") or "").strip(),
        },
        "job": {
            "title": job_title,
            "company": (job.get("company") or "").strip(),
            "description": (job.get("description") or "").strip(),
        },
        "user_context": {
            "full_name": (user_context.get("full_name") or "").strip(),
            "headline": (user_context.get("headline") or "").strip(),
            "skills": [s for s in (user_context.get("skills") or []) if isinstance(s, str)],
            "proof_points": (user_context.get("proof_points") or "").strip(),
        },
    }

    verdict: ReferralDraftVerdict = await llm_json(
        system_message=_DRAFT_SYSTEM,
        user_message=str(prompt_context),
        response_model=ReferralDraftVerdict,
        tier="fast",
        _resource="referral_draft",
    )
    return verdict