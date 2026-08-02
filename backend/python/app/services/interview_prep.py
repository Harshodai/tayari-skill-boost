"""Interview Prep Pack Builder.

Inspired by ai-job-search /interview command:
- STAR behavioral story mapping (Situation, Task, Action, Result)
- Stage-specific question bank generator
- Company background summary
- Mock interview roleplay prompts
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

from app.services.llm_service import llm_complete

logger = logging.getLogger(__name__)

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)

# ponytail: prompt-only fallback — a roleplay script the interviewer reads, not
# fabricated resume content, so it survives fallback; star_stories/questions do
# not (no invented facts).
_FALLBACK_MOCK_PROMPT_TEMPLATE = (
    "System Roleplay: Act as a senior interviewer at {company} conducting a {stage}. "
    "Ask technical questions one at a time and evaluate answers using the STAR framework."
)


def _parse_prep_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extract the prep-pack JSON object from LLM text; None on contract violation."""
    match = _JSON_BLOCK_RE.search(raw_text)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    stories = parsed.get("star_stories")
    questions = parsed.get("anticipated_questions")
    prompt = parsed.get("mock_interview_prompt")
    if not isinstance(stories, list) or not stories:
        return None
    for story in stories:
        if not isinstance(story, dict) or not all(
            isinstance(story.get(key), str)
            for key in ("topic", "situation", "task", "action", "result")
        ):
            return None
    if not isinstance(questions, list) or not all(isinstance(q, str) for q in questions):
        return None
    if not isinstance(prompt, str) or not prompt:
        return None
    return parsed


def _build_prep_prompt(
    resume_text: str, jd_text: str, company_name: str, interview_stage: str
) -> str:
    return f"""You are an elite interview coach. Build a behavioral interview prep pack for this candidate against the target role.
Strict Rules: Use ONLY facts, metrics, and experiences present in the Candidate Resume. Do NOT invent metrics or achievements.

Candidate Resume:
{resume_text[:2000]}

Target Job Description:
{jd_text[:2000]}

Target company: {company_name or "unspecified"}
Interview stage: {interview_stage}

Return ONLY a JSON object with EXACTLY this shape:
{{
  "star_stories": [
    {{"topic": "...", "situation": "...", "task": "...", "action": "...", "result": "..."}}
  ],
  "anticipated_questions": ["...", "..."],
  "mock_interview_prompt": "..."
}}

The mock_interview_prompt must roleplay a senior interviewer at {company_name or "the target company"} running a {interview_stage}, asking questions one at a time and evaluating answers with the STAR framework."""


class InterviewPrepEngine:
    """Builds comprehensive interview prep packs for target roles."""

    @staticmethod
    async def build_prep_pack(
        resume_text: str,
        jd_text: str,
        company_name: str = "",
        interview_stage: str = "Technical Screen",
    ) -> Dict[str, Any]:
        """Generate prep pack including STAR stories, anticipated questions, and mock protocol.

        STAR stories and anticipated questions are LLM-generated from the
        resume and JD. When the LLM is unavailable or its output violates the
        JSON contract, the pack degrades honestly: empty stories/questions plus
        a generation_status marker — no fabricated content.
        """

        company = company_name or "the target company"
        mock_interview_prompt = _FALLBACK_MOCK_PROMPT_TEMPLATE.format(
            company=company, stage=interview_stage
        )
        try:
            raw = await llm_complete(
                "",
                _build_prep_prompt(resume_text, jd_text, company_name, interview_stage),
                max_tokens=1000,
                temperature=0.4,
            )
            parsed = _parse_prep_json(raw)
        except Exception as exc:
            logger.warning("Interview prep LLM fallback: %s", exc)
            parsed = None

        generation_status = "llm"
        if parsed is None:
            # ponytail: "llm" only when the response was real AND parseable;
            # anything else is "fallback" so downstream consumers can reject it.
            generation_status = "fallback"
            parsed = {}

        return {
            "company_name": company_name,
            "interview_stage": interview_stage,
            "star_stories": parsed.get("star_stories", []),
            "anticipated_questions": parsed.get("anticipated_questions", []),
            "mock_interview_prompt": parsed.get("mock_interview_prompt", mock_interview_prompt),
            "generation_status": generation_status,
        }
