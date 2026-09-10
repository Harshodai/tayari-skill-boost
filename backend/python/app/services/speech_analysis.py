"""Shared speech analysis — single source of truth for WPM, fillers, and STAR detection."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List

FILLER_WORDS: tuple[str, ...] = ("um", "uh", "like", "you know", "basically", "actually", "sort of", "kind of", "i mean")

STAR_KEYWORDS: Dict[str, tuple[str, ...]] = {
    "situation": ("when", "at my", "working on", "project", "situation", "in my", "during"),
    "task": ("tasked", "responsible", "goal", "needed to", "objective", "had to"),
    "action": ("built", "implemented", "designed", "created", "led", "refactored", "developed", "i ", "we "),
    "result": ("result", "increased", "reduced", "improved", "saved", "outcome", "%", "percent", "metric"),
}


@dataclass
class SpeechTelemetry:
    """Deterministic cadence/filler/STAR analysis — never calls LLM, never 503."""
    wpm: int
    wpm_status: str  # "slow" | "good" | "fast" | "no speech detected"
    word_count: int
    filler_count: int
    filler_words_found: Dict[str, int]
    star_breakdown: Dict[str, str]  # "Present" | "Missing"
    star_score: int  # 0-100
    coaching_tips: List[str] = field(default_factory=list)


def analyze_speech(transcript: str, duration_seconds: float = 30.0) -> SpeechTelemetry:
    """Deterministic cadence/filler/STAR analysis (no LLM — never mock, never 503)."""
    text = (transcript or "").strip()
    words = re.findall(r"\b\w+\b", text.lower())
    word_count = len(words)
    duration = max(duration_seconds, 1.0)

    # WPM
    wpm = int(round(word_count / (duration / 60.0))) if words else 0
    if wpm == 0:
        wpm_status = "no speech detected"
    elif wpm < 110:
        wpm_status = "slow"
    elif wpm <= 160:
        wpm_status = "good"
    else:
        wpm_status = "fast"

    # Filler words
    text_lower = text.lower()
    filler_counts: Dict[str, int] = {}
    for filler in FILLER_WORDS:
        count = len(re.findall(rf"\b{re.escape(filler)}\b", text_lower))
        if count:
            filler_counts[filler] = count

    # STAR breakdown
    star_breakdown: Dict[str, str] = {}
    for component, keywords in STAR_KEYWORDS.items():
        star_breakdown[component] = "Present" if any(k in text_lower for k in keywords) else "Missing"

    star_score = sum(25 for v in star_breakdown.values() if v == "Present")

    # Coaching tips
    tips: List[str] = []
    if wpm and wpm < 110:
        tips.append("Pace is slow — aim for 120-150 words per minute.")
    if wpm > 160:
        tips.append("Pace is fast — slow down for clarity.")
    if filler_counts:
        top = max(filler_counts, key=filler_counts.get)
        tips.append(f"Most-used filler: \"{top}\" — pause instead.")
    missing = [k for k, v in star_breakdown.items() if v == "Missing"]
    if missing:
        tips.append(f"STAR gap: {', '.join(missing)} not clearly covered.")
    if not tips:
        tips.append("Strong cadence and STAR coverage — keep it up.")

    return SpeechTelemetry(
        wpm=wpm,
        wpm_status=wpm_status,
        word_count=word_count,
        filler_count=sum(filler_counts.values()),
        filler_words_found=filler_counts,
        star_breakdown=star_breakdown,
        star_score=star_score,
        coaching_tips=tips,
    )
