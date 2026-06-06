"""
Detector for AI-generated text patterns and flagger for improvement.
"""
import re
from typing import List, Tuple

from app.schemas import AIProofingAnalysis


class AIProofingDetector:
    """Detect AI patterns and suggest humanization."""

    # Common AI buzzword / generic phrase patterns
    GENERIC_PATTERNS = {
        "leverages,",
        "synergy",
        "utilized,",
        "leveraged,",
        "spearheaded,",
        "optimized,",
        "streamlined,",
        "orchestrated,",
        "facilitated,",
        "driving results",
        "results-driven",
        "proactive",
        "self-motivated",
        "team player",
        "detail-oriented",
        "passionate about",
        "enthusiastic about",
        "adept at",
        "proficient in",
        "highly skilled",
        "expert-level",
        "cutting-edge",
        "state-of-the-art",
        "next-gen",
        "world-class",
        "innovative solutions",
    }

    # Repetitive connector patterns common in AI
    CONNECTOR_PATTERNS = [
        (r"\b(furthermore|moreover|additionally|consequently|therefore|thus|hence)\b", "overused_transitions"),
        (r"\b(leveraged|utilized|capitalized on)\b", "weak_verbs"),
        (r"\b(demonstrated|showcased|exhibited)\b.*\b(ability|expertise|proficiency)\b", "showcase_cliche"),
        (r"\b(responsible for|tasked with|charged with)\b", "passive_voice"),
    ]

    def analyze(self, text: str) -> AIProofingAnalysis:
        if not text:
            return AIProofingAnalysis(risk_score=0)

        flagged_phrases = []
        total_flags = 0

        # Check generic patterns
        for phrase in self.GENERIC_PATTERNS:
            if phrase.lower() in text.lower():
                flagged_phrases.append(phrase)
                total_flags += 1

        # Check connector / structural patterns
        for pattern, label in self.CONNECTOR_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            total_flags += len(matches)
            if matches:
                flagged_phrases.append(f"[{label}] {', '.join(matches)}")

        # Calculate risk score: each flag ~5 points, capped at 100
        risk_score = min(total_flags * 5, 100)

        recommendations = self._build_recommendations(flagged_phrases, total_flags)

        return AIProofingAnalysis(
            risk_score=risk_score,
            flagged_phrases=flagged_phrases,
            recommendations=recommendations,
        )

    def _build_recommendations(self, flagged: List[str], total: int) -> List[str]:
        recs = []
        if not flagged:
            recs.append("No obvious AI patterns detected. Resume appears human-written.")
            return recs

        if total > 8:
            recs.append("High risk of AI detection. Rewrite heavily using personal, specific anecdotes.")
        elif total > 3:
            recs.append("Moderate AI risk. Replace generic buzzwords with concrete metrics and outcomes.")

        weak_checks = any("weak_verbs" in f for f in flagged)
        if weak_checks:
            recs.append("Replace weak verbs like 'utilized'/'leveraged' with stronger action verbs (built, created, shipped).")

        recs.append("Add specific metrics (%, $, time saved) to each bullet point.")
        recs.append("Vary sentence structure; avoid repeated transition words.")
        return recs
