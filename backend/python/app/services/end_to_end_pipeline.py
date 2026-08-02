"""End-to-End Autonomous Job Application Execution Engine.

Unifies:
1. LegitimacyChecker: Ghost Job risk assessment.
2. SemanticRoleMatcher: LLM dynamic role intent matching.
3. evaluate_5d_fit: 5D ATS application fit scoring.
4. DrafterReviewer: Tailored bullet points & cover letter generation.
5. OntologyGuard: Zero-hallucination claim verification.

Each stage runs in its own try/except so one failure degrades that stage
(recorded via a "status" key) without killing the pipeline or discarding
successful stage outputs. pipeline_status is derived from the guardrails
(ghost risk, role match, claim verification) — the ready status only when
all pass.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from app.guardrails.legitimacy_checker import LegitimacyChecker
from app.scoring.semantic_role_matcher import SemanticRoleMatcher
from app.services.ats_engine import evaluate_5d_fit
from app.ai_proofing.drafter_reviewer import DrafterReviewerEngine
from app.guardrails.ontology_guard import OntologyGuard

logger = logging.getLogger(__name__)

_STAGE_OK = "ok"
_STAGE_FAILED = "failed"


def _failure_cover_letter(company_name: str, target_role: str) -> str:
    return f"Dear Hiring Team at {company_name},\n\nI am writing to express my strong enthusiasm for the {target_role} position."


class EndToEndPipelineEngine:
    """Autonomous end-to-end job application processing engine."""

    @staticmethod
    def process_job_application(
        target_role: str,
        job_title: str,
        job_description: str,
        candidate_skills: List[str],
        verified_candidate_facts: List[str],
        company_name: str = "Target Corp"
    ) -> Dict[str, Any]:
        """Execute end-to-end application pipeline from posting text to tailored output artifacts."""
        # 1. Ghost Job Risk Assessment
        ghost_check: Dict[str, Any] = {"status": _STAGE_FAILED}
        try:
            ghost = LegitimacyChecker.evaluate_posting_legitimacy(job_title, job_description)
            ghost_check = {"status": _STAGE_OK, **ghost}
        except Exception as exc:
            logger.warning("Ghost job risk assessment stage failed: %s", exc)

        # 2. LLM Dynamic Role Intent Matching
        role_match: Dict[str, Any] = {"status": _STAGE_FAILED, "is_semantically_matched": False}
        try:
            match = SemanticRoleMatcher.classify_posting(target_role, job_title, job_description)
            role_match = {"status": _STAGE_OK, **match}
        except Exception as exc:
            logger.warning("Semantic role matching stage failed: %s", exc)

        # 3. 5D ATS Application Fit Evaluation
        ats_fit: Dict[str, Any] = {"status": _STAGE_FAILED, "overall_fit_score": 0.0}
        try:
            fit = evaluate_5d_fit(
                resume_text=" ".join(candidate_skills),
                jd_text=job_description,
                candidate_skills=candidate_skills
            )
            ats_fit = {"status": _STAGE_OK, **fit}
        except Exception as exc:
            logger.warning("5D ATS fit stage failed: %s", exc)

        # 4. Tailored Resume Bullet & Cover Letter Generation via Drafter-Reviewer loop:
        # drafter drafts from resume facts, reviewer critiques against the JD, loop
        # refines until quality threshold or max iterations. generate_tailored_application
        # is async; run it on this sync boundary (FastAPI route runs in a threadpool,
        # tests call synchronously).
        cover_letter: str = ""
        tailored_bullets: List[str] = []
        try:
            draft = asyncio.run(
                DrafterReviewerEngine.generate_tailored_application(
                    resume_text=" ".join(candidate_skills),
                    jd_text=job_description,
                    target_company=company_name,
                    target_role=target_role,
                )
            )
            if draft.get("draft_source") == "fallback":
                # ponytail: a fallback draft is fabricated content grounded in
                # nothing; treat the stage as failed rather than marking it
                # verified — an empty bullet list blocks downstream.
                logger.warning("Drafter-Reviewer produced a fallback draft; rejecting fabricated content")
                cover_letter = _failure_cover_letter(company_name, target_role)
                tailored_bullets = []
            else:
                cover_letter = draft.get("tailored_cover_letter", "")
                tailored_bullets = draft.get("tailored_resume_bullets", [])
        except Exception as exc:
            logger.warning("Drafter-Reviewer stage failed: %s", exc)
            cover_letter = _failure_cover_letter(company_name, target_role)

        # 5. Ontology Guard Factual Verification
        verified_bullets: List[Dict[str, Any]] = []
        for bullet in tailored_bullets:
            try:
                audit = OntologyGuard.validate_claim(bullet, candidate_skills, [company_name])
                is_verified = audit.get("is_valid", False)
            except Exception as exc:
                logger.warning("Ontology guard verification failed for bullet: %s", exc)
                is_verified = False
            verified_bullets.append({
                "bullet_text": bullet,
                "is_factually_verified": is_verified
            })

        # Guardrail-gated submission readiness: ready only when every guardrail passes.
        # ponytail: the ghost stage fails closed — a crashed or failed legitimacy
        # check (status != ok) cannot clear the posting, same as role mismatch.
        if ghost_check.get("status") != _STAGE_OK or ghost_check.get("is_ghost_job_risk") is True:
            pipeline_status = "BLOCKED_HIGH_GHOST_JOB_RISK"
        elif role_match.get("is_semantically_matched") is not True:
            pipeline_status = "BLOCKED_ROLE_MISMATCH"
        elif not verified_bullets or any(
            not bullet.get("is_factually_verified") for bullet in verified_bullets
        ):
            pipeline_status = "BLOCKED_UNVERIFIED_CLAIMS"
        else:
            pipeline_status = "COMPLETED_READY_FOR_SUBMISSION"

        return {
            "target_role": target_role,
            "job_title": job_title,
            "company_name": company_name,
            "ghost_job_risk": ghost_check,
            "semantic_role_match": role_match,
            "ats_5d_fit": ats_fit,
            "tailored_cover_letter": cover_letter,
            "factually_verified_bullets": verified_bullets,
            "pipeline_status": pipeline_status
        }
