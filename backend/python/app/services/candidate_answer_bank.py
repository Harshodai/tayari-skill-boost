"""
Candidate Answer Bank Service.
Stores deterministic answers for standard ATS application questions (work authorization,
visa sponsorship, salary expectations, notice period, location preferences, EEO parameters)
and provides fuzzy question matching to eliminate hallucinated answers during job auto-apply.
"""
from __future__ import annotations
import re
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field


class CandidateAnswers(BaseModel):
    work_authorization: str = Field(default="Authorized to work in the US without restriction", description="US work authorization status")
    requires_sponsorship: bool = Field(default=False, description="Whether visa sponsorship is required")
    sponsorship_answer: str = Field(default="No, I do not require sponsorship now or in the future.", description="Standard answer for sponsorship")
    target_salary_min: int = Field(default=140000, description="Minimum acceptable base salary in USD")
    target_salary_max: int = Field(default=180000, description="Target base salary in USD")
    salary_answer: str = Field(default="$150,000 - $180,000 (negotiable based on total compensation)", description="Formatted salary answer")
    notice_period_days: int = Field(default=14, description="Notice period in days")
    notice_period_answer: str = Field(default="2 weeks", description="Notice period response")
    relocation_willing: bool = Field(default=True, description="Willingness to relocate")
    work_preference: str = Field(default="Remote / Hybrid", description="Work location preference")
    years_experience: int = Field(default=5, description="Total professional years of experience")
    gender: Optional[str] = Field(default="Decline to Self-Identify", description="EEO Gender")
    race_ethnicity: Optional[str] = Field(default="Decline to Self-Identify", description="EEO Race/Ethnicity")
    veteran_status: Optional[str] = Field(default="I am not a protected veteran", description="EEO Veteran Status")
    disability_status: Optional[str] = Field(default="No, I do not have a disability", description="EEO Disability Status")
    custom_qa: Dict[str, str] = Field(default_factory=dict, description="Custom key-value question answer pairs")


DEFAULT_ANSWER_BANK = CandidateAnswers()


def match_question_to_answer(question_text: str, bank: CandidateAnswers = DEFAULT_ANSWER_BANK) -> Dict[str, Any]:
    """
    Fuzzy match an ATS form label or question prompt against the candidate answer bank.
    Returns dict with matched answer string, confidence score (0.0 to 1.0), and matched category.
    """
    q_lower = question_text.lower().strip()
    
    # 1. Work Authorization & Sponsorship
    if any(k in q_lower for k in ["sponsorship", "visa", "require sponsorship", "future sponsorship", "h1b"]):
        return {
            "matched": True,
            "answer": bank.sponsorship_answer if not bank.requires_sponsorship else "Yes, I will require sponsorship.",
            "value": "No" if not bank.requires_sponsorship else "Yes",
            "confidence": 0.98,
            "category": "sponsorship"
        }
    
    if any(k in q_lower for k in ["authorized to work", "legally authorized", "work authorization", "eligible to work"]):
        return {
            "matched": True,
            "answer": bank.work_authorization,
            "value": "Yes",
            "confidence": 0.98,
            "category": "work_authorization"
        }

    # 2. Salary Expectations
    if any(k in q_lower for k in ["salary", "compensation", "desired pay", "expected salary", "pay rate"]):
        return {
            "matched": True,
            "answer": bank.salary_answer,
            "value": str(bank.target_salary_max),
            "confidence": 0.95,
            "category": "salary"
        }

    # 3. Notice Period / Availability
    if any(k in q_lower for k in ["notice period", "start date", "how soon can you start", "available to start"]):
        return {
            "matched": True,
            "answer": bank.notice_period_answer,
            "value": bank.notice_period_answer,
            "confidence": 0.92,
            "category": "notice_period"
        }

    # 4. Years of Experience
    if any(k in q_lower for k in ["years of experience", "total experience", "how many years"]):
        return {
            "matched": True,
            "answer": f"{bank.years_experience} years",
            "value": str(bank.years_experience),
            "confidence": 0.90,
            "category": "years_experience"
        }

    # 5. EEO Questions
    if "gender" in q_lower or "sex" in q_lower:
        return {
            "matched": True,
            "answer": bank.gender or "Decline to Self-Identify",
            "value": bank.gender or "Decline",
            "confidence": 0.99,
            "category": "eeo_gender"
        }

    if any(k in q_lower for k in ["race", "ethnicity"]):
        return {
            "matched": True,
            "answer": bank.race_ethnicity or "Decline to Self-Identify",
            "value": bank.race_ethnicity or "Decline",
            "confidence": 0.99,
            "category": "eeo_race"
        }

    if "veteran" in q_lower:
        return {
            "matched": True,
            "answer": bank.veteran_status or "I am not a protected veteran",
            "value": bank.veteran_status or "No",
            "confidence": 0.99,
            "category": "eeo_veteran"
        }

    if "disability" in q_lower:
        return {
            "matched": True,
            "answer": bank.disability_status or "No, I do not have a disability",
            "value": bank.disability_status or "No",
            "confidence": 0.99,
            "category": "eeo_disability"
        }

    # 6. Check custom QA entries
    for key, val in bank.custom_qa.items():
        if key.lower() in q_lower:
            return {
                "matched": True,
                "answer": val,
                "value": val,
                "confidence": 0.88,
                "category": "custom"
            }

    return {
        "matched": False,
        "answer": "",
        "value": "",
        "confidence": 0.0,
        "category": "unknown"
    }
