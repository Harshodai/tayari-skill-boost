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
    TERMINAL_STATUSES = ("rejected", "offer_accepted", "offer_declined", "withdrawn")

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime:
        """Parse a follow-up timestamp: aware datetime preserved, naive assumed UTC."""
        if isinstance(value, datetime):
            if value.tzinfo is None:
                # ponytail: naive datetime assumed UTC, matching string parsing below
                return value.replace(tzinfo=timezone.utc)
            return value
        if isinstance(value, str):
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        raise TypeError(f"expected datetime or ISO-8601 string, got {type(value).__name__}")

    @staticmethod
    def inspect_applications(applications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify open applications that require follow-up attention."""
        stale_apps = []
        now = datetime.now(timezone.utc)

        for app in applications:
            status = (app.get("status") or "submitted").lower()
            if status in FollowupGenerator.TERMINAL_STATUSES:
                continue

            last_updated_value = app.get("last_updated_at") or app.get("submitted_at")
            if not last_updated_value:
                continue

            try:
                last_updated = FollowupGenerator._parse_timestamp(last_updated_value)
                days_quiet = (now - last_updated).days
            except (TypeError, ValueError) as exc:
                # ponytail: unparseable timestamp skips the app; the 11-day fallback would silently misclassify it as stale
                logger.warning(
                    "Skipping application %s: unparseable timestamp %r: %s",
                    app.get("id") or app.get("company"),
                    last_updated_value,
                    exc,
                )
                continue

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
    def draft_followup_message(company: str, role: str, candidate_name: str, followup_number: int = 1) -> Dict[str, Any]:
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
