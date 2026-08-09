"""V3 verified-human badge — stateless LLM scorers.

Two moderators produce the verification verdict inputs:
  1. truthfulness: claims are extracted and judged for supportability.
  2. screening: technical depth is scored against the claimed experience.

Go (authoritative) persists the results; this module never touches the DB.
LLMNotConfiguredError propagates — the route maps it to 503, never mock output.
"""
from typing import List

from pydantic import BaseModel, Field

from app.services.llm_service import llm_json


class TruthfulnessVerdict(BaseModel):
    truthful_score: float = Field(ge=0, le=100, description="0-100 supportability of claims")
    red_flags: List[str] = Field(default_factory=list, description="Unsupported or suspicious claims")


class ScreeningVerdict(BaseModel):
    screening_score: float = Field(ge=0, le=100, description="0-100 technical depth vs claimed experience")
    strengths: List[str] = Field(default_factory=list, max_length=3)
    gaps: List[str] = Field(default_factory=list, max_length=3)
    sample_questions: List[str] = Field(default_factory=list, max_length=3)


_TRUTH_SYSTEM = (
    "You are a rigorous resume fact-checker. For each claim in the resume, judge "
    "whether it is supportable given the evidence stated in the resume itself "
    "(experience duration, role seniority, listed skills). Treat unverifiable "
    "inflation (e.g. 'architected' without matching seniority/scope) as a red flag. "
    "Do not penalize missing detail — penalize claims that contradict or exceed "
    "the stated evidence."
)

_SCREENING_SYSTEM = (
    "You are a senior technical interviewer. Score the resume's demonstrated "
    "technical depth 0-100 against the experience and roles it claims, judging "
    "whether the achievements are consistent with the stated years and seniority. "
    "List the strongest strengths, the most material gaps, and up to three "
    "interview questions the candidate would plausibly face."
)


async def run_verification(resume_text: str) -> dict:
    """Run both moderators and return the combined verdict."""
    if not resume_text or not resume_text.strip():
        raise ValueError("resume_text must not be empty")

    truth: TruthfulnessVerdict = await llm_json(
        system_message=_TRUTH_SYSTEM,
        user_message=resume_text,
        response_model=TruthfulnessVerdict,
        tier="fast",
        _resource="verification_truthfulness",
    )
    screening: ScreeningVerdict = await llm_json(
        system_message=_SCREENING_SYSTEM,
        user_message=resume_text,
        response_model=ScreeningVerdict,
        tier="fast",
        _resource="verification_screening",
    )

    return {
        "truthful_score": truth.truthful_score,
        "red_flags": truth.red_flags,
        "screening_score": screening.screening_score,
        "strengths": screening.strengths,
        "gaps": screening.gaps,
        "sample_questions": screening.sample_questions,
    }