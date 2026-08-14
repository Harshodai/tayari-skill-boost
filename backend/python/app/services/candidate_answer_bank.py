"""
Candidate Answer Bank Service.

Sensitive employment, compensation, legal, and self-identification answers are
never invented. A missing user-owned answer remains unresolved and must be
routed to the human question queue.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class CandidateAnswers(BaseModel):
    """Explicitly supplied candidate answers; missing values remain unanswered."""

    work_authorization: Optional[str] = Field(default=None)
    requires_sponsorship: Optional[bool] = Field(default=None)
    sponsorship_answer: Optional[str] = Field(default=None)
    target_salary_min: Optional[int] = Field(default=None)
    target_salary_max: Optional[int] = Field(default=None)
    salary_answer: Optional[str] = Field(default=None)
    notice_period_days: Optional[int] = Field(default=None)
    notice_period_answer: Optional[str] = Field(default=None)
    relocation_willing: Optional[bool] = Field(default=None)
    work_preference: Optional[str] = Field(default=None)
    years_experience: Optional[int] = Field(default=None)
    gender: Optional[str] = Field(default=None)
    race_ethnicity: Optional[str] = Field(default=None)
    veteran_status: Optional[str] = Field(default=None)
    disability_status: Optional[str] = Field(default=None)
    custom_qa: Dict[str, str] = Field(default_factory=dict)

    @property
    def answers(self) -> Dict[str, Any]:
        """Return only explicitly supplied values; never synthesize defaults."""
        return {
            key: value
            for key, value in self.model_dump().items()
            if value is not None and value != {}
        }


# Compatibility symbol retained for callers, but it is intentionally empty.
DEFAULT_ANSWER_BANK = CandidateAnswers()


def get_answer_bank(user_id: str) -> CandidateAnswers:
    """Return a user-scoped answer snapshot placeholder.

    Persistence integration must supply the user-owned values. An absent or
    synthetic identity is rejected rather than receiving a global default bank.
    """
    if not user_id or user_id == "default_user":
        raise ValueError("authenticated user_id is required for candidate answers")
    return CandidateAnswers()


def _needs_human(category: str) -> Dict[str, Any]:
    return {
        "matched": False,
        "needs_human": True,
        "answer": "",
        "value": "",
        "confidence": 0.0,
        "category": category,
    }


def match_question_to_answer(
    question_text: str,
    bank: CandidateAnswers = DEFAULT_ANSWER_BANK,
) -> Dict[str, Any]:
    """Match only explicit values; unresolved sensitive fields require a human."""
    q_lower = question_text.lower().strip()

    if any(k in q_lower for k in ["sponsorship", "visa", "require sponsorship", "future sponsorship", "h1b"]):
        if bank.requires_sponsorship is None:
            return _needs_human("sponsorship")
        answer = bank.sponsorship_answer
        if not answer:
            answer = "Yes, I will require sponsorship." if bank.requires_sponsorship else "No, I do not require sponsorship now or in the future."
        return {
            "matched": True,
            "needs_human": False,
            "answer": answer,
            "value": "Yes" if bank.requires_sponsorship else "No",
            "confidence": 0.98,
            "category": "sponsorship",
        }

    if any(k in q_lower for k in ["authorized to work", "legally authorized", "work authorization", "eligible to work"]):
        if not bank.work_authorization:
            return _needs_human("work_authorization")
        return {
            "matched": True,
            "needs_human": False,
            "answer": bank.work_authorization,
            "value": "Yes",
            "confidence": 0.98,
            "category": "work_authorization",
        }

    if any(k in q_lower for k in ["salary", "compensation", "desired pay", "expected salary", "pay rate"]):
        if not bank.salary_answer or bank.target_salary_max is None:
            return _needs_human("salary")
        return {
            "matched": True,
            "needs_human": False,
            "answer": bank.salary_answer,
            "value": str(bank.target_salary_max),
            "confidence": 0.95,
            "category": "salary",
        }

    if any(k in q_lower for k in ["notice period", "start date", "how soon can you start", "available to start"]):
        if not bank.notice_period_answer:
            return _needs_human("notice_period")
        return {
            "matched": True,
            "needs_human": False,
            "answer": bank.notice_period_answer,
            "value": bank.notice_period_answer,
            "confidence": 0.92,
            "category": "notice_period",
        }

    if any(k in q_lower for k in ["years of experience", "total experience", "how many years"]):
        if bank.years_experience is None:
            return _needs_human("years_experience")
        return {
            "matched": True,
            "needs_human": False,
            "answer": f"{bank.years_experience} years",
            "value": str(bank.years_experience),
            "confidence": 0.90,
            "category": "years_experience",
        }

    if "gender" in q_lower or "sex" in q_lower:
        if not bank.gender:
            return _needs_human("eeo_gender")
        return {
            "matched": True,
            "needs_human": False,
            "answer": bank.gender,
            "value": bank.gender,
            "confidence": 0.99,
            "category": "eeo_gender",
        }

    if any(k in q_lower for k in ["race", "ethnicity"]):
        if not bank.race_ethnicity:
            return _needs_human("eeo_race")
        return {
            "matched": True,
            "needs_human": False,
            "answer": bank.race_ethnicity,
            "value": bank.race_ethnicity,
            "confidence": 0.99,
            "category": "eeo_race",
        }

    if "veteran" in q_lower:
        if not bank.veteran_status:
            return _needs_human("eeo_veteran")
        return {
            "matched": True,
            "needs_human": False,
            "answer": bank.veteran_status,
            "value": bank.veteran_status,
            "confidence": 0.99,
            "category": "eeo_veteran",
        }

    if "disability" in q_lower:
        if not bank.disability_status:
            return _needs_human("eeo_disability")
        return {
            "matched": True,
            "needs_human": False,
            "answer": bank.disability_status,
            "value": bank.disability_status,
            "confidence": 0.99,
            "category": "eeo_disability",
        }

    for key, val in bank.custom_qa.items():
        if key.lower() in q_lower:
            return {
                "matched": True,
                "needs_human": False,
                "answer": val,
                "value": val,
                "confidence": 0.88,
                "category": "custom",
            }

    return {
        "matched": False,
        "needs_human": False,
        "answer": "",
        "value": "",
        "confidence": 0.0,
        "category": "unknown",
    }
