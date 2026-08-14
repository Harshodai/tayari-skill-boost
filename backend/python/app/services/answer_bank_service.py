"""Answer Bank & Visa Sponsorship Checker Service.

Inspired by ai-job-search answer_bank and sponsorship detection modules:
Pre-populates application form questions (work authorization, visa sponsorship, salary, experience)
and scans scraped job posting markdown for visa sponsorship policies.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AnswerBank:
    """Resolves only explicitly supplied application answers."""

    # Kept as a compatibility surface for callers, but intentionally empty.
    # Sensitive answers must come from the authenticated candidate or queue.
    DEFAULT_ANSWERS: Dict[str, str] = {}

    @staticmethod
    def get_answer(question_key: str, default: str = "") -> str:
        """Get an explicit candidate answer, or return the caller's fallback."""
        key_clean = question_key.lower().replace(" ", "_")
        for k, v in AnswerBank.DEFAULT_ANSWERS.items():
            if k in key_clean or key_clean in k:
                return v
        # Never synthesize a legal, monetary, or self-identification answer.
        return default or ""


class SponsorshipChecker:
    """Detects visa sponsorship policies in job posting descriptions."""

    SPONSORSHIP_PATTERNS = {
        "no_sponsorship": [
            r"no\s+sponsorship",
            r"must\s+be\s+us\s+citizen",
            r"us\s+citizenship\s+required",
            r"security\s+clearance\s+required",
            r"unable\s+to\s+sponsor"
        ],
        "sponsorship_available": [
            r"visa\s+sponsorship\s+available",
            r"will\s+sponsor",
            r"h1b\s+transfer\s+accepted",
            r"sponsorship\s+provided"
        ]
    }

    @staticmethod
    def check_sponsorship_policy(jd_text: str) -> Dict[str, Any]:
        """Analyze job description text for visa sponsorship rules."""
        if not jd_text:
            return {"policy": "unknown", "confidence": 0.0, "reason": "Empty description"}

        text_lower = jd_text.lower()

        for pattern in SponsorshipChecker.SPONSORSHIP_PATTERNS["no_sponsorship"]:
            if re.search(pattern, text_lower):
                return {
                    "policy": "NO_SPONSORSHIP",
                    "confidence": 0.95,
                    "matched_pattern": pattern,
                    "reason": "Explicit no-sponsorship or citizenship requirement detected"
                }

        for pattern in SponsorshipChecker.SPONSORSHIP_PATTERNS["sponsorship_available"]:
            if re.search(pattern, text_lower):
                return {
                    "policy": "SPONSORSHIP_AVAILABLE",
                    "confidence": 0.95,
                    "matched_pattern": pattern,
                    "reason": "Explicit visa sponsorship offer detected"
                }

        return {
            "policy": "NOT_MENTIONED",
            "confidence": 0.50,
            "reason": "No explicit visa sponsorship statement found"
        }
