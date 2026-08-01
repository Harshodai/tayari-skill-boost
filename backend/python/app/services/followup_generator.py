"""Application Follow-Up Generator.

Inspired by ai-job-search /outcome followup command:
Scans open applications, identifies quiet ones (> 10 days without updates),
and drafts polite, recruiter-friendly follow-up emails grounded strictly in submitted materials.
Enforces a maximum cap of 2 follow-ups per application to prevent spamming recruiters.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class FollowupGenerator:
    """Detects quiet applications and generates follow-up drafts."""

    QUIET_DAYS_THRESHOLD = 10
    MAX_FOLLOWUPS_ALLOWED = 2

    @staticmethod
    def inspect_applications(applications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify open applications that require follow-up attention."""
        stale_apps = []
        now = datetime.now(timezone.utc)

        for app in applications:
            status = app.get("status", "submitted").lower()
            if status in ["rejected", "offer_accepted", "offer_declined", "withdrawn"]:
                continue

            last_updated_str = app.get("last_updated_at") or app.get("submitted_at")
            if not last_updated_str:
                continue

            try:
                # Parse ISO date string
                last_updated = datetime.fromisoformat(last_updated_str.replace("Z", "+00:00"))
                days_quiet = (now - last_updated).days
            except Exception:
                days_quiet = 11  # Fallback if unparseable

            followup_count = app.get("followup_count", 0)

            if days_quiet >= FollowupGenerator.QUIET_DAYS_THRESHOLD and followup_count < FollowupGenerator.MAX_FOLLOWUPS_ALLOWED:
                stale_apps.append({
                    "application_id": app.get("id") or app.get("company"),
                    "company": app.get("company", "Unknown Company"),
                    "role": app.get("role", "Target Role"),
                    "days_quiet": days_quiet,
                    "followup_count": followup_count,
                    "recommended_action": "draft_followup"
                })

        return stale_apps

    @staticmethod
    def draft_followup_message(company: str, role: str, candidate_name: str = "Candidate", followup_number: int = 1) -> Dict[str, Any]:
        """Draft a polite, concise follow-up email."""
        if followup_number == 1:
            subject = f"Following up: {role} Application at {company} - {candidate_name}"
            body = (
                f"Hi {company} Hiring Team,\n\n"
                f"I hope you're having a great week. I'm following up on my application for the {role} position "
                f"submitted recently. I remain very enthusiastic about the opportunity to contribute to {company}.\n\n"
                f"Please let me know if you need any additional information or work samples from my end.\n\n"
                f"Best regards,\n{candidate_name}"
            )
        else:
            subject = f"Re: {role} Application at {company} - {candidate_name}"

            body = (
                f"Hi {company} Hiring Team,\n\n"
                f"I wanted to quickly check in one final time regarding my application for the {role} role. "
                f"I understand you are busy reviewing candidates, but I remain very interested in the position.\n\n"
                f"Thank you for your time and consideration.\n\n"
                f"Best regards,\n{candidate_name}"
            )

        return {
            "company": company,
            "role": role,
            "subject": subject,
            "body": body,
            "followup_number": followup_number
        }
