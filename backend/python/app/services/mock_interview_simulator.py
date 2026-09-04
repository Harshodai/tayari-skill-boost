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
        from app.services.interview_ai import InterviewPrepGenerator
        star_res = InterviewPrepGenerator.analyze_star_answer(candidate_answer, question=question)
        answer_len = len(candidate_answer.strip().split())

        feedback: List[str] = list(star_res.get("coaching_tips", []))
        for comp, detail in star_res.get("breakdown", {}).items():
            if detail.get("feedback"):
                feedback.append(f"{comp.capitalize()}: {detail['feedback']}")

        return {
            "question": question,
            "score": star_res["completeness_score"],
            "completeness_score": star_res["completeness_score"],
            "word_count": answer_len,
            "star_framework_detected": star_res["completeness_score"] >= 50,
            "star_breakdown": star_res.get("breakdown", {}),
            "missing_elements": star_res.get("missing_elements", []),
            "weak_elements": star_res.get("weak_elements", []),
            "follow_up_question": star_res.get("follow_up_question", ""),
            "follow_up_target": star_res.get("follow_up_target", "general"),
            "feedback": feedback,
        }
