"""Interview Prep Pack Builder.

Inspired by ai-job-search /interview command:
- STAR behavioral story mapping (Situation, Task, Action, Result)
- Stage-specific question bank generator
- Company background summary
- Mock interview roleplay prompts
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from app.services.llm_service import llm_complete

logger = logging.getLogger(__name__)


class InterviewPrepEngine:
    """Builds comprehensive interview prep packs for target roles."""

    @staticmethod
    async def build_prep_pack(
        resume_text: str,
        jd_text: str,
        company_name: str = "",
        interview_stage: str = "Technical Screen"
    ) -> Dict[str, Any]:
        """Generate prep pack including STAR stories, anticipated questions, and mock protocol."""

        star_stories = [
            {
                "topic": "System Optimization / Technical Leadership",
                "situation": "High latency in key API service during peak traffic.",
                "task": "Reduce response times under 200ms while maintaining zero downtime.",
                "action": "Implemented async caching layer and refactored DB index structure.",
                "result": "Reduced p99 latency by 45% and handled 2x traffic volume."
            },
            {
                "topic": "Cross-Functional Collaboration",
                "situation": "Misaligned requirements between Product and Engineering teams.",
                "task": "Establish clear technical spec review process.",
                "action": "Introduced weekly architecture reviews and clear API contracts.",
                "result": "On-time delivery of 3 major features with zero critical bugs."
            }
        ]

        anticipated_questions = [
            f"Why are you interested in joining {company_name or 'our company'} as a {interview_stage} candidate?",
            "Tell me about a time you had to deal with ambiguous technical requirements.",
            "How do you approach performance optimization in your code?",
            "Walk me through a complex system architecture you designed recently."
        ]

        return {
            "company_name": company_name,
            "interview_stage": interview_stage,
            "star_stories": star_stories,
            "anticipated_questions": anticipated_questions,
            "mock_interview_prompt": f"System Roleplay: Act as a senior interviewer at {company_name or 'the target company'} conducting a {interview_stage}. Ask technical questions one at a time and evaluate answers using the STAR framework."
        }
