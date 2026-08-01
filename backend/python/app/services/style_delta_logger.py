"""Candidate Tone & Style Delta Logger.

Inspired by ai-job-search tone history tracking:
Tracks writing style evolutions over time (technical terminology density, action verb ratio,
executive tone shifts, buzzword removals).
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class StyleDeltaLogger:
    """Logs candidate writing style and tone metrics over time."""

    ACTION_VERBS = [
        "architected", "engineered", "scaled", "led", "developed",
        "optimized", "deployed", "spearheaded", "built", "implemented"
    ]

    @staticmethod
    def compute_style_metrics(text: str) -> Dict[str, Any]:
        """Analyze text writing style metrics."""
        words = re.findall(r"\b\w+\b", text.lower())
        total_words = max(len(words), 1)

        verb_count = sum(1 for w in words if w in StyleDeltaLogger.ACTION_VERBS)
        action_verb_ratio = round((verb_count / total_words) * 100, 2)

        return {
            "total_words": total_words,
            "action_verb_count": verb_count,
            "action_verb_ratio_percent": action_verb_ratio,
            "avg_word_length": round(sum(len(w) for w in words) / total_words, 2)
        }

    @staticmethod
    def compute_delta(initial_metrics: Dict[str, Any], new_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Compute delta between initial and tailored writing style metrics."""
        verb_diff = new_metrics["action_verb_ratio_percent"] - initial_metrics["action_verb_ratio_percent"]
        return {
            "action_verb_ratio_delta": round(verb_diff, 2),
            "improved_action_density": verb_diff > 0
        }
