"""iCalendar Application Event Exporter (.ics).

Inspired by ai-job-search /calendar command:
Exports interview schedules, application deadlines, and follow-up milestones into standard
iCalendar (.ics) files compatible with Apple Calendar, Google Calendar, and Outlook.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

TIMEZONE = timezone.utc


def _escape_ical_text(text: str) -> str:
    """Escape iCalendar TEXT property values (RFC 5545 section 3.3.11)."""
    return (
        text.replace("\\", "\\\\")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\n", "\\n")
        .replace(";", "\\;")
        .replace(",", "\\,")
    )


class CalendarExporter:
    """Generates .ics format calendar strings for job application events."""

    @staticmethod
    def generate_ics_event(
        summary: str,
        description: str,
        start_datetime_iso: str,
        location: str = "Remote / Online",
        event_id: Optional[str] = None,
    ) -> str:
        """Generate standard iCalendar (.ics) string."""
        now_str = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        # ponytail: fromisoformat rejects trailing Z before Python 3.11
        start_iso = start_datetime_iso[:-1] + "+00:00" if start_datetime_iso.endswith("Z") else start_datetime_iso
        start_dt = datetime.fromisoformat(start_iso)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=TIMEZONE)
        clean_start = start_dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

        if event_id:
            uid = f"tayari-event-{event_id}@tayari.ai"
        else:
            uid = f"tayari-event-{uuid.uuid4().hex}@tayari.ai"

        ics_content = (
            "BEGIN:VCALENDAR\r\n"
            "VERSION:2.0\r\n"
            "PRODID:-//TayariSkillBoost//JobSearchCalendar 1.0//EN\r\n"
            "BEGIN:VEVENT\r\n"
            f"UID:{uid}\r\n"
            f"DTSTAMP:{now_str}\r\n"
            f"DTSTART:{clean_start}\r\n"
            f"SUMMARY:{_escape_ical_text(summary)}\r\n"
            f"DESCRIPTION:{_escape_ical_text(description)}\r\n"
            f"LOCATION:{_escape_ical_text(location)}\r\n"
            "STATUS:CONFIRMED\r\n"
            "END:VEVENT\r\n"
            "END:VCALENDAR\r\n"
        )
        return ics_content
