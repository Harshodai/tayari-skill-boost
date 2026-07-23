"""Live Interview Co-Pilot Service — Tayari AI Engine.

Generates real-time candidate answer hints (STAR technique), technical formula cheat-sheets,
and voice transcript audio analysis (filler words, speech pace WPM, STAR alignment scoring).
"""

from __future__ import annotations
import re
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from app.services.llm_service import llm_complete

logger = logging.getLogger(__name__)


class CopilotHintRequest(BaseModel):
    interviewer_transcript: str
    target_role: Optional[str] = "Software Engineer"
    candidate_skills: Optional[List[str]] = Field(default_factory=list)


class CopilotHintResponse(BaseModel):
    question_detected: str
    hint_type: str  # "STAR_BEHAVIORAL", "TECHNICAL_EXPLANATION", "SYSTEM_DESIGN"
    key_points: List[str]
    suggested_opening: str


class VoiceAnalysisRequest(BaseModel):
    candidate_transcript: str
    question_context: Optional[str] = ""
    duration_seconds: float = 30.0


class VoiceAnalysisResponse(BaseModel):
    word_count: int
    wpm: float
    speech_pace_rating: str  # "Too Slow", "Optimal (120-160 WPM)", "Too Fast"
    filler_word_count: int
    filler_words_detected: Dict[str, int]
    star_score: float  # 0-100
    technical_confidence_score: float  # 0-100
    overall_rating: str
    key_strengths: List[str]
    improvement_tips: List[str]


FILLER_PATTERNS = [
    (r"\bum\b", "um"),
    (r"\buh\b", "uh"),
    (r"\blike\b", "like"),
    (r"\byou know\b", "you know"),
    (r"\bBasically\b", "basically"),
    (r"\bactually\b", "actually"),
    (r"\bso yeah\b", "so yeah"),
    (r"\bI mean\b", "i mean"),
]


def analyze_candidate_speech(req: VoiceAnalysisRequest) -> VoiceAnalysisResponse:
    """Perform deterministic speech pace & filler word analysis on candidate transcript."""
    text = req.candidate_transcript.strip()
    words = text.split()
    word_count = len(words)
    minutes = max(req.duration_seconds / 60.0, 0.1)
    wpm = round(word_count / minutes, 1)

    if wpm < 100:
        speech_pace_rating = "Slow (<100 WPM)"
    elif 100 <= wpm <= 165:
        speech_pace_rating = "Optimal (120-160 WPM)"
    else:
        speech_pace_rating = "Fast (>165 WPM)"

    filler_counts: Dict[str, int] = {}
    total_fillers = 0
    for pattern, name in FILLER_PATTERNS:
        matches = len(re.findall(pattern, text, re.IGNORECASE))
        if matches > 0:
            filler_counts[name] = matches
            total_fillers += matches

    # STAR score heuristic
    has_situation = bool(re.search(r"(when|at|during|project|situation|task|goal)", text, re.IGNORECASE))
    has_action = bool(re.search(r"(i built|i led|i designed|i implemented|i optimized|i decided)", text, re.IGNORECASE))
    has_result = bool(re.search(r"(result|impact|increased|decreased|reduced|%|percent|metric)", text, re.IGNORECASE))

    star_score = 50.0
    if has_situation: star_score += 15.0
    if has_action: star_score += 20.0
    if has_result: star_score += 15.0
    star_score = min(star_score - (total_fillers * 3), 100.0)
    star_score = max(star_score, 20.0)

    tech_confidence = min(85.0 + (word_count * 0.2) - (total_fillers * 4), 98.0)

    strengths = []
    if has_action:
        strengths.append("Clear ownership and action-oriented verbs used")
    if has_result:
        strengths.append("Quantifiable metrics and results included in answer")
    if 100 <= wpm <= 165:
        strengths.append("Excellent, confident speaking pace")

    tips = []
    if total_fillers > 2:
        tips.append(f"Reduce vocal fillers ({total_fillers} detected: {', '.join(filler_counts.keys())})")
    if not has_result:
        tips.append("Always state measurable metrics or outcome at the end of your answer")
    if wpm > 165:
        tips.append("Pause slightly between key points to improve candidate clarity")

    return VoiceAnalysisResponse(
        word_count=word_count,
        wpm=wpm,
        speech_pace_rating=speech_pace_rating,
        filler_word_count=total_fillers,
        filler_words_detected=filler_counts,
        star_score=round(star_score, 1),
        technical_confidence_score=round(tech_confidence, 1),
        overall_rating="Strong" if star_score >= 80 else "Good" if star_score >= 65 else "Needs Improvement",
        key_strengths=strengths or ["Clear response structure"],
        improvement_tips=tips or ["Maintain steady vocal cadence"],
    )


async def generate_interview_hint(request: CopilotHintRequest) -> CopilotHintResponse:
    """Generate real-time candidate hints from interviewer transcript snippet."""
    transcript = request.interviewer_transcript.strip()
    if not transcript:
        return CopilotHintResponse(
            question_detected="Listening...",
            hint_type="WAITING",
            key_points=["Speak clearly", "Structure answer using STAR (Situation, Task, Action, Result)"],
            suggested_opening="Thank you for that question."
        )

    prompt = (
        f"You are a real-time AI interview copilot assisting a candidate for a {request.target_role} position.\n"
        f"Interviewer speech snippet: '{transcript}'\n"
        f"Candidate key skills: {', '.join(request.candidate_skills or ['Full Stack Engineering', 'System Architecture'])}\n\n"
        f"Provide an instant response aid in JSON with fields:\n"
        f"- question_detected: short summary of interviewer question\n"
        f"- hint_type: 'STAR_BEHAVIORAL', 'TECHNICAL_EXPLANATION', or 'SYSTEM_DESIGN'\n"
        f"- key_points: 3 concise bullet points candidate should mention\n"
        f"- suggested_opening: 1 strong opening sentence for candidate\n"
    )

    try:
        raw_res = await llm_complete(
            prompt,
            system_prompt="You are a real-time interview co-pilot. Be extremely concise, direct, and actionable.",
            temperature=0.2
        )
        import json
        match = re.search(r"\{.*\}", raw_res, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return CopilotHintResponse(**data)
    except Exception as exc:
        logger.warning("Falling back to rule-based copilot hint: %s", exc)

    return CopilotHintResponse(
        question_detected=transcript[:80],
        hint_type="STAR_BEHAVIORAL",
        key_points=[
            "Describe a specific Situation & Task with measurable metrics",
            "Explain your technical Action and key trade-offs evaluated",
            "Conclude with the quantifiable Result and key learning"
        ],
        suggested_opening="That's a great question. In a recent project, I encountered a similar challenge where..."
    )
