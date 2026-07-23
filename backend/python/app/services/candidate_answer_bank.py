"""Candidate Answer Bank Service.

Manages persistent answers to standard and recurring ATS screening questions
(e.g., work authorization, notice period, salary expectations, custom essay responses).

Data is persisted to a JSON file on disk for durability across restarts.
"""

from __future__ import annotations
import json
import logging
import os
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DEFAULT_SCREENING_ANSWERS: Dict[str, str] = {
    "work_authorization": "Yes, I am authorized to work in the country.",
    "sponsorship_required": "No, I do not require visa sponsorship now or in the future.",
    "notice_period": "2 weeks",
    "desired_salary": "Open to discussion based on competitive market rates and role scope.",
    "relocation": "Open to remote or relocation for the right role.",
    "why_us": "I am drawn to your team's mission, engineering rigor, and culture of building high-impact products.",
    "greatest_strength": "Problem solving with high-throughput distributed systems and delivering clean, maintainable code rapidly."
}

_STORAGE_PATH = os.environ.get("ANSWER_BANK_STORAGE_PATH",
                               os.path.join(os.path.dirname(__file__), "..", "..", "data", "answer_banks.json"))


class CandidateAnswerBank(BaseModel):
    user_id: str = "default_user"
    answers: Dict[str, str] = Field(default_factory=lambda: DEFAULT_SCREENING_ANSWERS.copy())

    def get_answer_for_question(self, question: str) -> str:
        """Match a screening question string against stored candidate answers."""
        q_lower = question.lower()
        if "sponsor" in q_lower:
            return self.answers.get("sponsorship_required", DEFAULT_SCREENING_ANSWERS["sponsorship_required"])
        if "authorize" in q_lower or "legally eligible" in q_lower:
            return self.answers.get("work_authorization", DEFAULT_SCREENING_ANSWERS["work_authorization"])
        if "notice" in q_lower or "start date" in q_lower:
            return self.answers.get("notice_period", DEFAULT_SCREENING_ANSWERS["notice_period"])
        if "salary" in q_lower or "compensation" in q_lower or "pay" in q_lower:
            return self.answers.get("desired_salary", DEFAULT_SCREENING_ANSWERS["desired_salary"])
        if "relocat" in q_lower:
            return self.answers.get("relocation", DEFAULT_SCREENING_ANSWERS["relocation"])
        if "why" in q_lower and ("company" in q_lower or "us" in q_lower or "role" in q_lower):
            return self.answers.get("why_us", DEFAULT_SCREENING_ANSWERS["why_us"])
        return "Based on candidate background: Experienced software professional eager to contribute immediately to this role."


_answer_banks: Dict[str, CandidateAnswerBank] = {}


def _load_banks() -> Dict[str, CandidateAnswerBank]:
    if not os.path.exists(_STORAGE_PATH):
        return {}
    try:
        with open(_STORAGE_PATH, "r") as f:
            raw = json.load(f)
        return {uid: CandidateAnswerBank(user_id=uid, answers=data.get("answers", DEFAULT_SCREENING_ANSWERS.copy()))
                for uid, data in raw.items()}
    except Exception as exc:
        logger.warning("Failed to load answer banks: %s", exc)
        return {}


def _save_banks(banks: Dict[str, CandidateAnswerBank]) -> None:
    try:
        os.makedirs(os.path.dirname(_STORAGE_PATH), exist_ok=True)
        with open(_STORAGE_PATH, "w") as f:
            json.dump({uid: {"answers": bank.answers} for uid, bank in banks.items()}, f)
    except Exception as exc:
        logger.warning("Failed to save answer banks: %s", exc)


def get_answer_bank(user_id: str) -> CandidateAnswerBank:
    """Retrieve or create an answer bank instance keyed by user_id.

    Raises ValueError if user_id is empty or None.
    Data is loaded from disk on first access and persisted on each mutation.
    """
    if not user_id:
        raise ValueError("user_id is required and must be non-empty")
    if user_id not in _answer_banks:
        persisted = _load_banks()
        _answer_banks.update(persisted)
        if user_id not in _answer_banks:
            _answer_banks[user_id] = CandidateAnswerBank(user_id=user_id)
            _save_banks(_answer_banks)
    return _answer_banks[user_id]
