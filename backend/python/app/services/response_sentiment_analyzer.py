"""Recruiter Response Sentiment Analyzer.

Inspired by ai-job-search response sentiment classification:
Classifies incoming recruiter email and message text into categories:
INTERVIEW_INVITE, INFORMATION_REQUEST, REJECTION, OFFER, and AUTO_REPLY.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict

logger = logging.getLogger(__name__)


class ResponseSentimentAnalyzer:
    """Classifies recruiter response messages into actionable categories."""

    PATTERNS = {
        "OFFER": [
            r"pleased\s+to\s+offer",
            r"offer\s+letter",
            r"congratulations.*offer"
        ],
        "INTERVIEW_INVITE": [
            r"schedule\0a\s+interview",
            r"schedule\s+a\s+call",
            r"invitation\s+to\s+interview",
            r"availability\s+for\s+a\s+chat",
            r"time\s+to\s+speak"
        ],
        "REJECTION": [
            r"regret\s+to\s+inform",
            r"decided\s+to\s+pursue\s+other",
            r"unfortunatly",
            r"not\s+moving\s+forward",
            r"position\s+has\s+been\s+filled"
        ],
        "AUTO_REPLY": [
            r"auto\s*reply",
            r"out\s+of\s+office",
            r"automatic\s+response"
        ]
    }

    @staticmethod
    def classify_response(email_text: str) -> Dict[str, Any]:
        """Classify recruiter message into outcome categories."""
        if not email_text:
            return {"category": "UNKNOWN", "confidence": 0.0}

        text_lower = email_text.lower()

        for category, regex_list in ResponseSentimentAnalyzer.PATTERNS.items():
            for pattern in regex_list:
                if re.search(pattern, text_lower):
                    return {
                        "category": category,
                        "confidence": 0.90,
                        "matched_pattern": pattern
                    }

        return {
            "category": "INFORMATION_REQUEST",
            "confidence": 0.50,
            "reason": "Default fallback classification"
        }
