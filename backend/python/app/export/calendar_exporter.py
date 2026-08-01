"""iCalendar Application Event Exporter (.ics).

Inspired by ai-job-search /calendar command:
Exports interview schedules, application deadlines, and follow-up milestones into standard
iCalendar (.ics) files compatible with Apple Calendar, Google Calendar, and Outlook.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)


class CalendarExporter:
    """Generates .ics format calendar strings for job application events."""

    @staticmethod
    def generate_ics_event(
        summary: str,
        description: str,
        start_datetime_iso: str,
        location: str = "Remote / Online"
    ) -> str:
        """Generate standard iCalendar (.ics) string."""
        now_str = datetime.now(timezone.utc).strftime("%Y%MT%H%M%SZ")
        clean_start = start_datetime_iso.replace("-", "").replace(":", "").replace(".000", "")[:15] + "Z"

        ics_content = (
            "BEGIN:VCALENDAR\r\n"
            "VERSION:2.0\r\n"
            "PRODID:-//TayariSkillBoost//JobSearchCalendar 1.0//EN\r\n"
            "BEGIN:VEVENT\r\n"
            f"UID:tayari-event-{now_str}@tayari.ai\r\n"
            f"DTSTAMP:{now_str}\r\n"
            f"DTSTART:{clean_start}\r\n"
            f"SUMMARY:{summary}\r\n"
            f"DESCRIPTION:{description}\r\n"
            f"LOCATION:{location}\r\n"
            "STATUS:CONFIRMED\r\n"
            "END:VEVENT\r\n"
            "END:VCALENDAR\r\n"
        )
        return ics_content
