"""
Recruiter Intelligence & Referral Radar Service.
Discovers hiring manager email patterns, candidate referral channels, and drafts personalized warm intro request emails.
"""
from __future__ import annotations
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class RecruiterContact(BaseModel):
    company_name: str
    company_domain: str
    email_pattern: str
    suggested_emails: List[str] = Field(default_factory=list)
    referral_intro_template: str
    cold_outreach_subject: str
    cold_outreach_body: str


def generate_recruiter_intelligence(
    company_name: str,
    job_title: str,
    hiring_manager_name: Optional[str] = None,
    user_name: str = "Candidate",
    user_skills: List[str] = None
) -> RecruiterContact:
    """
    Generate recruiter email candidates, email pattern heuristics, and referral templates.
    """
    clean_domain = re.sub(r'[^a-zA-Z0-9]', '', company_name.lower()) + ".com"
    skills_str = ", ".join(user_skills[:3]) if user_skills else "software engineering & system architecture"

    mgr_name = hiring_manager_name or "Hiring Manager"
    first_name = mgr_name.split()[0] if mgr_name else "Hiring"
    last_name = mgr_name.split()[-1] if len(mgr_name.split()) > 1 else "Manager"

    suggested_emails = [
        f"{first_name.lower()}.{last_name.lower()}@{clean_domain}",
        f"{first_name.lower()}@{clean_domain}",
        f"{first_name[0].lower()}{last_name.lower()}@{clean_domain}",
        f"careers@{clean_domain}",
        f"recruiting@{clean_domain}"
    ]

    referral_intro = (
        f"Hi [Contact Name],\n\n"
        f"I noticed you're currently working at {company_name}! I'm applying for the {job_title} role "
        f"and have a strong background in {skills_str}.\n\n"
        f"Would you be open to a quick 5-minute chat or passing along my resume for an internal referral? "
        f"I'd deeply appreciate any insights on the team culture!\n\n"
        f"Best regards,\n{user_name}"
    )

    outreach_subject = f"Application for {job_title} — {user_name} (Background in {skills_str})"
    outreach_body = (
        f"Hi {first_name},\n\n"
        f"I recently submitted my application for the {job_title} role at {company_name}.\n\n"
        f"Given my hands-on experience in {skills_str}, I am confident I can make an immediate impact on your team's goals. "
        f"I've attached my ATS-optimized resume for your convenience.\n\n"
        f"Would you have 10 minutes next week for a brief introductory call?\n\n"
        f"Best regards,\n{user_name}"
    )

    return RecruiterContact(
        company_name=company_name,
        company_domain=clean_domain,
        email_pattern="first.last@" + clean_domain,
        suggested_emails=suggested_emails,
        referral_intro_template=referral_intro,
        cold_outreach_subject=outreach_subject,
        cold_outreach_body=outreach_body
    )


def find_recruiter_intel(company_name: str, job_title: str) -> Dict[str, Any]:
    """Helper alias returning dict for one_shot_engine and legacy endpoints."""
    res = generate_recruiter_intelligence(company_name, job_title)
    return {
        "company": res.company_name,
        "role": res.job_title,
        "recruiter_name": "Hiring Team",
        "patterns": res.suggested_emails,
        "cold_email": {
            "subject": res.cold_outreach_subject,
            "body": res.cold_outreach_body
        },
        "followup_1": {
            "subject": f"Re: Application for {job_title} — Brief insight",
            "body": f"Hi,\n\nFollowing up on my application for {job_title} at {company_name}. I would love to connect for 5 minutes.\n\nBest regards,"
        },
        "linkedin_note": res.referral_intro_template
    }

