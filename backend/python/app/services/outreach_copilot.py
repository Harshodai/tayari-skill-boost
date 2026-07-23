"""Recruiter Cold Outreach Copilot — Tayari AI Engine.

Generates hyper-personalized cold outreach emails and LinkedIn connection messages
tailored to hiring managers, recruiters, and engineering leads.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict

from app.services.llm_service import llm_complete

logger = logging.getLogger(__name__)


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
        "Write concise, highly compelling, non-spammy outreach messages to hiring managers."
    )

    user_prompt = f"""Write cold outreach for a candidate reaching out to {rec_name} at {comp} for a {role} position.
Candidate Proof Point: {proof}

Provide:
1. Cold Email (Subject + 3 concise paragraphs under 120 words total + low friction CTA).
2. LinkedIn Connection Note (strictly under 280 characters).
3. 5-Day Follow-Up Bump Email (under 50 words).
"""

    llm_output = await llm_complete(system_prompt, user_prompt, max_tokens=600)

    # Standard high-converting template fallbacks
    cold_email_subject = f"Quick question re: {role} role at {comp}"
    cold_email_body = f"""Hi {rec_name},

I noticed {comp} is expanding its engineering team for the {role} role and wanted to reach out directly.

Over the past few years, I've specialized in building high-concurrency systems. Most recently: {proof}

Are you open to a brief 5-minute chat next Tuesday morning to see if my background aligns with your team's current priorities?

Best regards,"""

    linkedin_note = f"Hi {rec_name}, I saw {comp} is hiring for a {role}. Given my background in building high-throughput systems, I'd love to connect and follow your team's work!"
    followup_bump = f"Hi {rec_name}, following up briefly on my note below. I'd still love to share how my experience could help {comp}. Are you free for a quick chat this week?"

    # Email pattern predictions
    first_name = rec_name.split()[0].lower() if rec_name else "hiring.manager"
    last_name = rec_name.split()[-1].lower() if len(rec_name.split()) > 1 else ""
    domain = comp.lower().replace(" ", "").replace(",", "").replace(".", "") + ".com"

    predicted_emails = [
        f"{first_name}.{last_name}@{domain}" if last_name else f"{first_name}@{domain}",
        f"{first_name}@{domain}",
        f"{first_name[0]}{last_name}@{domain}" if last_name else f"{first_name}1@{domain}",
        f"recruiting@{domain}",
        f"careers@{domain}"
    ]

    return {
        "company": comp,
        "role": role,
        "recruiter_name": rec_name,
        "predicted_emails": predicted_emails,
        "cold_email": {
            "subject": cold_email_subject,
            "body": cold_email_body,
        },
        "linkedin_note": linkedin_note,
        "followup_bump": followup_bump,
        "ai_raw": llm_output,
    }
