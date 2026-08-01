"""Interactive Mock Interview Simulator.

Inspired by ai-job-search mock interview simulation modules:
Generates role-specific technical and STAR behavioral interview question pools
and evaluates candidate response quality with actionable feedback.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class MockInterviewSimulator:
    """Generates mock interview question sets and evaluates candidate answers."""

    QUESTION_BANK = {
        "technical": [
            "Explain how you design a fault-tolerant microservices architecture.",
            "How do you optimize SQL database query performance under heavy read loads?",
            "What strategies do you use for zero-downtime deployment and schema migrations?"
        ],
        "behavioral": [
            "Tell me about a time you led a challenging engineering project under tight deadlines.",
            "Describe a situation where you had a technical disagreement with a teammate and how you resolved it.",
            "Give an example of how you handled a production outage or critical failure."
        ]
    }

    @staticmethod
    def generate_interview_session(role_title: str) -> Dict[str, Any]:
        """Generate a structured 5-question mock interview question set."""
        tech_q = MockInterviewSimulator.QUESTION_BANK["technical"]
        beh_q = MockInterviewSimulator.QUESTION_BANK["behavioral"]

        return {
            "role_title": role_title,
            "total_questions": len(tech_q) + len(beh_q),
            "technical_questions": tech_q,
            "behavioral_questions": beh_q
        }

    @staticmethod
    def evaluate_answer(question: str, candidate_answer: str) -> Dict[str, Any]:
        """Evaluate a candidate's answer for STAR structure and technical depth."""
        answer_len = len(candidate_answer.strip().split())
        has_star_elements = any(kw in candidate_answer.lower() for kw in ["situation", "task", "action", "result", "led", "achieved"])

        score = 70
        feedback: List[str] = []

        if answer_len < 30:
            score -= 20
            feedback.append("Answer is too brief — elaborate on your specific contributions.")
        elif answer_len > 80:
            score += 10
            feedback.append("Good detail provided in answer.")

        if has_star_elements:
            score += 15
            feedback.append("Demonstrated clear STAR behavioral framework.")
        else:
            feedback.append("Consider structuring response explicitly around Situation, Task, Action, and Result.")

        score = min(score, 100)

        return {
            "question": question,
            "score": score,
            "word_count": answer_len,
            "star_framework_detected": has_star_elements,
            "feedback": feedback
        }
