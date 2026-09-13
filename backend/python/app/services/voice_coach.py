"""WebSockets Real-Time Voice Interview Coach — Tayari AI Engine.

Evaluates candidate spoken responses for:
- Words Per Minute (WPM) speed pacing
- Filler word counts ("um", "uh", "like", "you know", "basically")
- STAR framework structure alignment
- AI interviewer follow-up questions
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

FILLER_WORDS = ["um", "uh", "like", "you know", "basically", "actually", "sort of", "kind of", "i mean"]


@dataclass
class VoiceFeedbackResult:
    transcript: str
    word_count: int
    duration_seconds: float
    wpm: float
    wpm_status: str  # "TOO_FAST", "OPTIMAL", "TOO_SLOW"
    filler_word_count: int
    filler_words_found: Dict[str, int]
    star_breakdown: Dict[str, float]
    overall_score: float
    interviewer_followup: str
    coaching_tips: List[str] = field(default_factory=list)


def analyze_transcript_metrics(
    transcript: str,
    duration_seconds: float = 30.0,
    target_role: str = "Software Engineer",
) -> VoiceFeedbackResult:
    """Analyze candidate transcript for speech metrics and STAR alignment."""
    text = (transcript or "").strip()
    words = re.findall(r"\b\w+\b", text.lower())
    word_count = len(words)

    # Calculate WPM
    duration = max(duration_seconds, 1.0)
    wpm = round((word_count / duration) * 60.0, 1)

    if wpm > 165:
        wpm_status = "TOO_FAST"
    elif wpm < 110:
        wpm_status = "TOO_SLOW"
    else:
        wpm_status = "OPTIMAL"

    # Count filler words
    text_lower = text.lower()
    filler_found = {}
    total_fillers = 0
    for filler in FILLER_WORDS:
        count = len(re.findall(r"\b" + re.escape(filler) + r"\b", text_lower))
        if count > 0:
            filler_found[filler] = count
            total_fillers += count

    # Calculate STAR framework breakdown
    has_situation = any(k in text_lower for k in ["when", "at my previous", "working on", "project", "situation"])
    has_task = any(k in text_lower for k in ["tasked", "responsible", "goal", "needed to", "objective"])
    has_action = any(k in text_lower for k in ["built", "implemented", "designed", "created", "led", "refactored", "developed"])
    has_result = any(k in text_lower for k in ["result", "increased", "reduced", "improved", "saved", "%", "percent", "metric"])

    star_breakdown = {
        "situation": 20.0 if has_situation else 5.0,
        "task": 15.0 if has_task else 5.0,
        "action": 45.0 if has_action else 15.0,
        "result": 20.0 if has_result else 0.0,
    }
    star_score = sum(star_breakdown.values())

    # Overall score combining STAR, pacing, filler words
    pacing_penalty = 15.0 if wpm_status != "OPTIMAL" else 0.0
    filler_penalty = min(total_fillers * 3.0, 20.0)
    overall_score = max(round(star_score - pacing_penalty - filler_penalty, 1), 10.0)

    # Coaching tips
    tips = []
    if wpm_status == "TOO_FAST":
        tips.append("Slow down slightly (target 120-150 WPM) to project confidence and clarity.")
    elif wpm_status == "TOO_SLOW":
        tips.append("Pick up the pace slightly to maintain engagement.")

    if total_fillers > 2:
        tips.append(f"Pause silently instead of using filler words ({total_fillers} filler words detected).")

    if not has_result:
        tips.append("Quantify your impact! State exact percentage improvements, metric gains, or revenue impact.")

    if not tips:
        tips.append("Great answer structure! Clear articulation and solid STAR alignment.")

    # Generic follow-up question prompt
    followup = (
        f"What was the biggest technical obstacle you faced while executing that, and how did you overcome it?"
        if has_action
        else f"Can you detail the specific technical actions you personally took during this project?"
    )

    return VoiceFeedbackResult(
        transcript=text,
        word_count=word_count,
        duration_seconds=duration,
        wpm=wpm,
        wpm_status=wpm_status,
        filler_word_count=total_fillers,
        filler_words_found=filler_found,
        star_breakdown=star_breakdown,
        overall_score=overall_score,
        interviewer_followup=followup,
        coaching_tips=tips,
    )
