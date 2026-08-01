"""Recruiter Cold Outreach & InMail Generator.

Inspired by ai-job-search /reachout command:
Drafts customized LinkedIn InMail and cold outreach emails to recruiters and hiring managers
highlighting relevant candidate skills and experience.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class RecruiterOutreach:
    """Generates cold outreach messages to recruiters and hiring managers."""

    @staticmethod
    def draft_outreach(
        company: str,
        role: str,
        recruiter_name: str = "Hiring Manager",
        candidate_name: str = "Candidate",
        key_skills: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Generate tailored InMail and cold email drafts."""
        skills_str = ", ".join(key_skills) if key_skills else "distributed systems and cloud architecture"

        inmail_subject = f"{role} Opportunity at {company} - {candidate_name}"
        inmail_body = (
            f"Hi {recruiter_name},\n\n"
            f"I saw the {role} posting at {company} and wanted to reach out directly. "
            f"I have extensive background in {skills_str} and have delivered high-impact engineering projects.\n\n"
            f"I'd love to connect for a quick 10-minute chat to see if my experience aligns with what your team is looking for.\n\n"
            f"Best regards,\n{candidate_name}"
        )

        return {
            "company": company,
            "role": role,
            "recruiter_name": recruiter_name,
            "inmail_subject": inmail_subject,
            "inmail_body": inmail_body
        }
