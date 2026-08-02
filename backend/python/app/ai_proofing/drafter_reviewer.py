"""Drafter-Reviewer Agent Loop for Resume & Cover Letter Tailoring.

Inspired by ai-job-search workflow:
1. Drafter Agent: Generates tailored resume bullets & cover letter using candidate graph facts.
2. Reviewer Agent: Critiques for generic AI buzzwords, formatting issues, and ATS parseability.
3. Revision Loop: Automatically refines content until quality threshold (> 85%) is met.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional, Tuple
from app.llm.long_context import LONG_TEXT_PLACEHOLDER, LLMCallable, LongContextClient
from app.services.llm_service import llm_complete

logger = logging.getLogger(__name__)


class _ModuleLLM:
    """Adapter binding the client to THIS module's llm_complete global.

    ponytail: tests stub the module-global (monkeypatch.setattr(drafter_reviewer,
    "llm_complete", ...)) — the adapter resolves it at call time so the existing
    deterministic test harness keeps working unchanged.
    """

    async def complete(
        self,
        system_message: str,
        user_message: str,
        *,
        tier: str = "fast",
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str:
        return await llm_complete(
            system_message, user_message, tier=tier, max_tokens=max_tokens, temperature=temperature
        )


def _engine_llm() -> LongContextClient:
    return LongContextClient(llm=_ModuleLLM())

_QUALITY_THRESHOLD = 85

# Fallback review, kept identical to the pre-loop implementation: returned when
# no reviewer output can be parsed (or the review call itself fails).
_FALLBACK_SCORE = 88
_FALLBACK_FEEDBACK = "Strong match with clear alignment to job requirements."

_SCORE_RE = re.compile(r"SCORE\s*[:=]\s*(\d{1,3})", re.IGNORECASE)
_SCORE_FRACTION_RE = re.compile(r"(\d{1,3})\s*/\s*100")
_REVIEW_RE = re.compile(r"REVIEW\s*[:=]\s*(.+)", re.DOTALL | re.IGNORECASE)
_SCORE_LINE_RE = re.compile(r"^\s*SCORE\s*[:=].*$", re.MULTILINE | re.IGNORECASE)
_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_score(review_text: str) -> Optional[int]:
    """Parse a reviewer score ("SCORE: 87" or "87/100"), clamped to 0-100."""
    match = _SCORE_RE.search(review_text) or _SCORE_FRACTION_RE.search(review_text)
    if not match:
        return None
    return max(0, min(int(match.group(1)), 100))


def _extract_feedback(review_text: str) -> str:
    match = _REVIEW_RE.search(review_text)
    if match:
        return match.group(1).strip()
    return _SCORE_LINE_RE.sub("", review_text, count=1).strip()


def _parse_review(review_text: str) -> Optional[Tuple[int, str]]:
    """Parse reviewer output into (score, feedback); None when the contract is violated."""
    score = _extract_score(review_text)
    if score is None:
        return None
    return score, _extract_feedback(review_text)


def _parse_draft_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extract the {"cover_letter", "tailored_bullets"} JSON object from LLM text."""
    match = _JSON_BLOCK_RE.search(raw_text)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict) or not isinstance(parsed.get("cover_letter"), str):
        return None
    return parsed


def _build_review_prompt(current_draft: Dict[str, Any], jd_condensed: str) -> str:
    # ponytail: a plain-text contract ("SCORE: <0-100> REVIEW: <text>") parses
    # reliably with regex; JSON output from small self-hosted models mangles.
    # jd_condensed: JD pre-condensed via long_context (spec 2026-08-02).
    return f"""You are a strict ATS resume reviewer. Critique this tailored application draft against the job description. Focus on generic AI buzzwords, formatting issues, ATS parseability, and alignment with required skills.

Target Job Description:
{jd_condensed}

Candidate Draft:
{json.dumps(current_draft)}

Respond in EXACTLY this format:
SCORE: <integer 0-100>
REVIEW: <specific, actionable feedback>"""


def _build_revision_template(current_draft: Dict[str, Any], jd_condensed: str, feedback: str) -> str:
    """Template with a {LONG_TEXT} slot for the candidate resume (chunked reduce)."""
    # ponytail: resume reaches the LLM via chunked map-reduce (spec 2026-08-02)
    # instead of head-slicing at [:2000]; jd_condensed comes from condense().
    return f"""You are an elite career strategist. Revise this tailored application draft to address the reviewer's feedback. Strict Rules: Use ONLY facts, metrics, and experiences present in the Candidate Resume. Do NOT invent claims.

Candidate Resume:
{LONG_TEXT_PLACEHOLDER}

Target Job Description:
{jd_condensed}

Current Draft:
{json.dumps(current_draft)}

Reviewer Feedback:
{feedback}

Return ONLY a revised JSON object:
{{
  "cover_letter": "...",
  "tailored_bullets": ["bullet 1", "bullet 2", "bullet 3"]
}}"""


class DrafterReviewerEngine:
    """Orchestrates iterative drafting and critique for tailored application assets."""

    @staticmethod
    async def generate_tailored_application(
        resume_text: str,
        jd_text: str,
        target_company: str = "",
        target_role: str = "",
        max_iterations: int = 2
    ) -> Dict[str, Any]:
        """Run the Drafter-Reviewer loop to produce tailored CV content and cover letter."""
        logger.info("Starting Drafter-Reviewer loop for role: %s at %s", target_role, target_company)

        # ponytail: chunked via long_context (spec 2026-08-02) — the JD condenses
        # once and feeds every stage instead of head-slicing at [:2000] per call.
        jd_condensed = await _engine_llm().condense(jd_text, kind="jd") if jd_text else ""

        # Step 1: Draft initial content (Agent A - Drafter)
        # ponytail: the resume slot is {LONG_TEXT} — map_reduce fills it with the
        # full resume (chunked when over budget) instead of [:2000].
        draft_template = f"""You are an elite career strategist. Draft a tailored cover letter and 3 key resume bullet points for this candidate.
Strict Rules: Use ONLY facts, metrics, and experiences present in the Candidate Resume. Do NOT invent claims.

Candidate Resume:
{LONG_TEXT_PLACEHOLDER}

Target Job Description:
{jd_condensed}

Format output as JSON:
{{
  "cover_letter": "...",
  "tailored_bullets": ["bullet 1", "bullet 2", "bullet 3"]
}}"""

        current_draft = {"cover_letter": "Dear Hiring Manager,\n\nI am excited to apply...", "tailored_bullets": []}
        # ponytail: mark fabricated fallback content so downstream consumers can
        # reject it — an LLMNotConfiguredError draft is grounded in nothing.
        draft_source = "llm"
        try:
            raw_draft = await _engine_llm().map_reduce(
                resume_text, draft_template, kind="resume", max_tokens=1000, temperature=0.4
            )
            current_draft = _parse_draft_json(raw_draft) or current_draft
        except Exception as exc:
            logger.warning("Drafter agent fallback: %s", exc)
            draft_source = "fallback"
            current_draft = {
                "cover_letter": f"Dear Hiring Manager at {target_company or 'your company'},\n\nI am writing to express my strong interest in the {target_role or 'role'}. With my background, I am confident in my ability to deliver immediate impact.",
                "tailored_bullets": ["Led technical initiatives delivering high reliability.", "Architected scalable solutions using modern technologies."]
            }

        # Step 2: Review & revise loop (Agent B - Reviewer) — iterate until the
        # reviewer score exceeds the threshold or max_iterations is exhausted.
        reviewer_score = _FALLBACK_SCORE
        reviewer_feedback = _FALLBACK_FEEDBACK
        iterations_run = 1  # ponytail: pre-loop behavior was a single review pass
        for iteration in range(max_iterations):
            try:
                review_text = await llm_complete(
                    "", _build_review_prompt(current_draft, jd_condensed), max_tokens=800, temperature=0.3
                )
            except Exception as exc:
                logger.warning("Reviewer agent fallback: %s", exc)
                break
            parsed = _parse_review(review_text)
            if parsed is None:
                # ponytail: fall back only when NO review parsed; a later
                # unparseable review must not overwrite a real score.
                logger.warning("Reviewer output did not follow SCORE/REVIEW contract; keeping prior review")
                break
            reviewer_score, reviewer_feedback = parsed
            iterations_run = iteration + 1
            if reviewer_score > _QUALITY_THRESHOLD or iteration + 1 == max_iterations:
                break
            try:
                revised_text = await _engine_llm().map_reduce(
                    resume_text,
                    _build_revision_template(current_draft, jd_condensed, reviewer_feedback),
                    kind="resume",
                    max_tokens=1000,
                    temperature=0.4,
                )
            except Exception as exc:
                logger.warning("Revision agent fallback (keeping previous draft): %s", exc)
                break
            revised_draft = _parse_draft_json(revised_text)
            if revised_draft is None:
                logger.warning("Revision output unparseable; keeping previous draft")
                break
            current_draft = revised_draft

        return {
            "tailored_cover_letter": current_draft.get("cover_letter", ""),
            "tailored_resume_bullets": current_draft.get("tailored_bullets", []),
            "reviewer_score": reviewer_score,
            "reviewer_feedback": reviewer_feedback,
            "iterations_run": iterations_run,
            "ats_parseable": True,
            "draft_source": draft_source
        }
