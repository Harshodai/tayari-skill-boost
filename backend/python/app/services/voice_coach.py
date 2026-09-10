"""WebSockets Real-Time Voice Interview Coach — Tayari AI Engine.

Evaluates candidate spoken responses for:
- Words Per Minute (WPM) speed pacing
- Filler word counts ("um", "uh", "like", "you know", "basically")
- STAR framework structure alignment
- AI interviewer follow-up questions
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

from app.services.speech_analysis import analyze_speech, SpeechTelemetry
from app.services.response_sentiment_analyzer import ResponseSentimentAnalyzer

logger = logging.getLogger(__name__)


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
    sentiment: Dict[str, Any] = field(default_factory=dict)


def analyze_transcript_metrics(
    transcript: str,
    duration_seconds: float = 30.0,
    target_role: str = "Software Engineer",
) -> VoiceFeedbackResult:
    """Analyze candidate transcript for speech metrics and STAR alignment."""
    telemetry = analyze_speech(transcript, duration_seconds)

    # Map shared telemetry to legacy VoiceFeedbackResult fields
    star_breakdown = {
        "situation": 20.0 if telemetry.star_breakdown["situation"] == "Present" else 5.0,
        "task": 15.0 if telemetry.star_breakdown["task"] == "Present" else 5.0,
        "action": 45.0 if telemetry.star_breakdown["action"] == "Present" else 15.0,
        "result": 20.0 if telemetry.star_breakdown["result"] == "Present" else 0.0,
    }
    star_score = sum(star_breakdown.values())

    # WPM status mapping: shared module uses "slow"/"good"/"fast", legacy uses "TOO_SLOW"/"OPTIMAL"/"TOO_FAST"
    wpm_status_map = {"slow": "TOO_SLOW", "good": "OPTIMAL", "fast": "TOO_FAST", "no speech detected": "TOO_SLOW"}
    wpm_status = wpm_status_map.get(telemetry.wpm_status, "OPTIMAL")

    pacing_penalty = 15.0 if wpm_status != "OPTIMAL" else 0.0
    filler_penalty = min(telemetry.filler_count * 3.0, 20.0)
    overall_score = max(round(star_score - pacing_penalty - filler_penalty, 1), 10.0)

    # LLM-powered follow-up question
    followup = _generate_followup(transcript, target_role)

    # Coaching tips from shared module
    tips = list(telemetry.coaching_tips)
    if telemetry.filler_count > 2:
        tips.append(f"Pause silently instead of using filler words ({telemetry.filler_count} filler words detected).")
    if telemetry.star_breakdown["result"] == "Missing":
        tips.append("Quantify your impact! State exact percentage improvements, metric gains, or revenue impact.")

    clean_transcript = (transcript or "").strip()
    sentiment = ResponseSentimentAnalyzer.classify_response(clean_transcript)

    return VoiceFeedbackResult(
        transcript=clean_transcript,
        word_count=telemetry.word_count,
        duration_seconds=max(duration_seconds, 1.0),
        wpm=float(telemetry.wpm),
        wpm_status=wpm_status,
        filler_word_count=telemetry.filler_count,
        filler_words_found=telemetry.filler_words_found,
        star_breakdown=star_breakdown,
        overall_score=overall_score,
        interviewer_followup=followup,
        coaching_tips=tips,
        sentiment=sentiment,
    )


def analyze_response_sentiment(text: str) -> Dict[str, Any]:
    """Classify interview or recruiter response sentiment and category."""
    return ResponseSentimentAnalyzer.classify_response(text or "")


async def generate_followup_question(
    transcript: str,
    target_role: str = "Software Engineer",
    previous_question: str = "",
) -> str:
    """LLM-powered follow-up question based on the candidate's answer."""
    return _generate_followup(transcript, target_role, previous_question)


def _generate_followup(transcript: str, target_role: str = "Software Engineer", previous_question: str = "") -> str:
    """Synchronous wrapper — calls LLM via llm_complete for follow-up generation.

    Falls back to a context-aware heuristic if the LLM is unavailable.
    """
    text = (transcript or "").strip()
    if not text:
        return "Can you walk me through a challenging project you've worked on?"

    try:
        import asyncio

        async def _call_llm() -> str:
            from app.services.llm_service import llm_complete
            prompt = (
                f"You are an experienced {target_role} interviewer. "
                f"The candidate just answered: \"{text[:500]}\"\n\n"
                f"Generate ONE concise follow-up interview question that probes deeper "
                f"into their answer. Be specific and professional."
            )
            return await llm_complete(
                system_message="You are a professional interviewer. Output only the follow-up question, nothing else.",
                user_message=prompt,
                max_tokens=100,
                temperature=0.7,
            )

        # If an event loop is running, use it; otherwise create one
        try:
            loop = asyncio.get_running_loop()
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = loop.run_until_complete(_call_llm())
            return result.strip().strip('"').strip("'")
        except RuntimeError:
            return asyncio.run(_call_llm()).strip().strip('"').strip("'")
    except Exception as exc:
        logger.warning("LLM follow-up generation failed, using heuristic: %s", exc)

    # Heuristic fallback — contextually better than the old hardcoded string
    text_lower = text.lower()
    if any(k in text_lower for k in ("result", "increased", "reduced", "improved", "%")):
        return "How did you measure that impact, and what would you do differently next time?"
    if any(k in text_lower for k in ("team", "we ", "led", "managed")):
        return "How did you handle disagreements or alignment within the team on that project?"
    if any(k in text_lower for k in ("built", "designed", "implemented", "created")):
        return "What tradeoffs did you consider when choosing that technical approach?"
    return "What was the biggest technical obstacle you faced, and how did you overcome it?"
