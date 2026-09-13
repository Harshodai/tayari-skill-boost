"""Multi-Agent Skill Router (WP-12).

Routes tasks across deterministic heuristic engines and multi-tier LLM models.
Core design requirements:
- Defines canonical task types:
    ats_score, resume_analysis, job_discovery_extraction, cover_letter,
    interview_questions, company_brief_extraction, fit_matrix_dimension
- Deterministic routing:
    `ats_score` routes directly to heuristic ATS scorer (ats_scorer.py) with
    ZERO LLM calls and 0 cost.
- Quality-tier routing:
    `job_discovery_extraction` & `company_brief_extraction` -> fast/cheap tier (Gemini 2.0 Flash / Haiku).
    `resume_analysis`, `cover_letter`, `interview_questions` -> high-quality reasoning tier (Claude 3.5 Sonnet / GPT-4o).
    `fit_matrix_dimension` -> balanced/fast tier.
- Latency target adaptation:
    Supports `X-Latency-Target: fast | balanced | quality` header to adjust model tier dynamically.
- Subagent orchestrator integration:
    Integrated with SubagentOrchestrator to route subagent tasks cleanly.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from app.services import llm_service
from app.services.prompt_safety import untrusted as _untrusted, UNTRUSTED_INSTRUCTION as _UNTRUSTED_INSTRUCTION

logger = logging.getLogger("tayari.agent.skill_router")


class SkillTaskType(str, Enum):
    """Canonical task types supported by the Multi-Agent Skill Router."""
    ATS_SCORE = "ats_score"
    RESUME_ANALYSIS = "resume_analysis"
    JOB_DISCOVERY_EXTRACTION = "job_discovery_extraction"
    COVER_LETTER = "cover_letter"
    INTERVIEW_QUESTIONS = "interview_questions"
    COMPANY_BRIEF_EXTRACTION = "company_brief_extraction"
    FIT_MATRIX_DIMENSION = "fit_matrix_dimension"


class LatencyTarget(str, Enum):
    """Dynamic latency target tier modifier."""
    FAST = "fast"
    BALANCED = "balanced"
    QUALITY = "quality"


# Base tier mapping for each task type under balanced conditions
TASK_BASE_TIERS: Dict[SkillTaskType, Optional[str]] = {
    SkillTaskType.ATS_SCORE: None,  # Deterministic heuristic - NO LLM
    SkillTaskType.JOB_DISCOVERY_EXTRACTION: "cheap",
    SkillTaskType.COMPANY_BRIEF_EXTRACTION: "cheap",
    SkillTaskType.RESUME_ANALYSIS: "smart",
    SkillTaskType.COVER_LETTER: "smart",
    SkillTaskType.INTERVIEW_QUESTIONS: "smart",
    SkillTaskType.FIT_MATRIX_DIMENSION: "fast",
}

# Human-readable target model descriptors
MODEL_DESCRIPTIONS: Dict[str, str] = {
    "deterministic": "Deterministic Heuristic Scorer (0 LLM calls, $0.00 cost)",
    "cheap": "Fast/Cheap Tier (e.g. Gemini 2.0 Flash / Claude 3 Haiku)",
    "fast": "Balanced/Fast Tier (e.g. GPT-4o-mini / Llama 3.1 70B)",
    "smart": "High-Quality Reasoning Tier (e.g. Claude 3.5 Sonnet / GPT-4o)",
    "deep": "Deep Reasoning/Judge Tier (e.g. Claude Opus / DeepSeek R1 / o3)",
}


def normalize_task_type(task_type: Union[SkillTaskType, str]) -> SkillTaskType:
    """Normalize input string or enum into SkillTaskType."""
    if isinstance(task_type, SkillTaskType):
        return task_type
    val = str(task_type or "").strip().lower().replace("-", "_")
    for member in SkillTaskType:
        if member.value == val:
            return member
    raise ValueError(
        f"Unsupported task_type '{task_type}'. Valid types: {[t.value for t in SkillTaskType]}"
    )


def normalize_latency_target(target: Optional[Union[LatencyTarget, str]]) -> LatencyTarget:
    """Normalize input latency target string or enum."""
    if isinstance(target, LatencyTarget):
        return target
    val = str(target or "balanced").strip().lower()
    if val in {"fast", "speed", "low_latency"}:
        return LatencyTarget.FAST
    if val in {"quality", "reasoning", "max"}:
        return LatencyTarget.QUALITY
    return LatencyTarget.BALANCED


def extract_latency_target_from_headers(
    headers: Optional[Dict[str, str]] = None,
    default: Union[LatencyTarget, str] = LatencyTarget.BALANCED,
) -> LatencyTarget:
    """Extract and normalize X-Latency-Target from HTTP headers."""
    if not headers:
        return normalize_latency_target(default)
    for k, v in headers.items():
        if k.lower() in ("x-latency-target", "latency-target"):
            return normalize_latency_target(v)
    return normalize_latency_target(default)


def resolve_model_tier(
    task_type: Union[SkillTaskType, str],
    latency_target: Union[LatencyTarget, str] = LatencyTarget.BALANCED,
) -> Optional[str]:
    """Resolve the effective LLM tier for a task based on latency targets.

    Returns None for deterministic tasks (ats_score).
    """
    task = normalize_task_type(task_type)
    target = normalize_latency_target(latency_target)

    base_tier = TASK_BASE_TIERS.get(task)
    if base_tier is None:
        return None  # Deterministic task

    # Adjust tier based on latency target
    if target == LatencyTarget.FAST:
        if base_tier in ("smart", "deep"):
            return "fast"
        if base_tier == "fast":
            return "cheap"
        return "cheap"

    if target == LatencyTarget.QUALITY:
        if base_tier == "cheap":
            return "fast"
        if base_tier == "fast":
            return "smart"
        if base_tier == "smart":
            return "deep"
        return "deep"

    # LatencyTarget.BALANCED
    return base_tier


def get_routing_info(
    task_type: Union[SkillTaskType, str],
    latency_target: Union[LatencyTarget, str] = LatencyTarget.BALANCED,
) -> Dict[str, Any]:
    """Return structured routing diagnostics for a given task and latency target."""
    task = normalize_task_type(task_type)
    target = normalize_latency_target(latency_target)
    tier = resolve_model_tier(task, target)

    if tier is None:
        model_desc = MODEL_DESCRIPTIONS["deterministic"]
    else:
        model_desc = MODEL_DESCRIPTIONS.get(tier, tier)

    return {
        "task_type": task.value,
        "is_deterministic": tier is None,
        "latency_target": target.value,
        "effective_tier": tier or "none",
        "model_descriptor": model_desc,
    }


def execute_ats_score(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Execute ATS scoring using deterministic heuristic algorithms.

    ZERO LLM calls and 0 cost.
    """
    from app.analysis.similarity import KeywordAnalyzer
    from app.analysis.ngram_analyzer import NGramAnalyzer
    from app.parsers.document_parser import ResumeParser, ParsedResume
    from app.scoring.ats_scorer import ATSScorer

    resume_text = str(payload.get("resume_text") or "")
    job_description = str(payload.get("job_description") or "")
    resume_obj = payload.get("resume")
    resume_parsed: Optional[ParsedResume] = None

    if isinstance(resume_obj, ParsedResume):
        resume_parsed = resume_obj
    elif resume_text:
        try:
            resume_parsed = ResumeParser.parse_text(resume_text)
        except Exception as exc:
            logger.debug("ResumeParser.parse_text error (continuing with text only): %s", exc)
            resume_parsed = None

    keyword_analyzer = KeywordAnalyzer()
    ngram_analyzer = NGramAnalyzer()
    ats_scorer = ATSScorer()

    keywords = keyword_analyzer.analyze(resume_text, job_description)
    ngrams = ngram_analyzer.analyze(resume_text, job_description)

    score_result = ats_scorer.score(
        keywords=keywords,
        ngrams=ngrams,
        resume=resume_parsed,
        resume_text=resume_text,
        job_description=job_description,
    )

    output = score_result.model_dump() if hasattr(score_result, "model_dump") else score_result.dict()
    output["llm_calls"] = 0
    output["cost_usd"] = 0.0
    output["router_task"] = SkillTaskType.ATS_SCORE.value
    output["execution_mode"] = "deterministic_heuristic"
    return output


class SkillRouter:
    """Skill Router orchestrating deterministic heuristic & multi-tier LLM executions."""

    def __init__(self) -> None:
        pass

    async def route_and_execute(
        self,
        task_type: Union[SkillTaskType, str],
        payload: Dict[str, Any],
        latency_target: Union[LatencyTarget, str] = LatencyTarget.BALANCED,
        headers: Optional[Dict[str, str]] = None,
        _user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Route and execute a task according to its specification and latency target."""
        task = normalize_task_type(task_type)
        if headers and "X-Latency-Target" in headers or headers and "x-latency-target" in headers:
            target = extract_latency_target_from_headers(headers, default=latency_target)
        else:
            target = normalize_latency_target(latency_target)

        # 1. Deterministic task: ats_score (0 LLM calls, 0 cost)
        if task == SkillTaskType.ATS_SCORE:
            logger.info("SkillRouter: routing '%s' to deterministic ATS heuristic engine (0 LLM calls).", task.value)
            return execute_ats_score(payload)

        # 2. LLM-based tasks: resolve quality tier
        tier = resolve_model_tier(task, target) or "fast"
        logger.info("SkillRouter: routing '%s' (latency_target=%s) to tier='%s'.", task.value, target.value, tier)

        # If custom prompts are passed directly in the payload
        if "system_prompt" in payload and "user_prompt" in payload:
            text = await llm_service.llm_complete(
                system_message=payload["system_prompt"],
                user_message=payload["user_prompt"],
                tier=tier,
                _user_id=_user_id,
                _resource=task.value,
            )
            return {
                "task_type": task.value,
                "tier": tier,
                "latency_target": target.value,
                "output": text,
            }

        # Specialized skill implementations
        if task == SkillTaskType.JOB_DISCOVERY_EXTRACTION:
            raw_text = payload.get("raw_text") or payload.get("job_text") or ""
            system = "You extract structured job metadata from raw job listings." + _UNTRUSTED_INSTRUCTION
            user = f"""Extract job metadata.
JOB LISTING:
{_untrusted(raw_text[:8000])}

Return JSON:
{{
  "title": "", "company": "", "location": "", "remote": <true|false>,
  "salary_min": <int or null>, "salary_max": <int or null>,
  "required_skills": ["<str>"], "preferred_skills": ["<str>"],
  "summary": "<2-sentence overview>"
}}"""
            res = await llm_service.llm_json(system, user, tier=tier, _user_id=_user_id, _resource=task.value)
            return {"task_type": task.value, "tier": tier, "result": res}

        if task == SkillTaskType.COMPANY_BRIEF_EXTRACTION:
            company = payload.get("company", "")
            raw_info = payload.get("raw_info", "")
            system = "You extract concise company intelligence for job candidates." + _UNTRUSTED_INSTRUCTION
            user = f"""Extract intelligence for company: {_untrusted(company)}
DATA:
{_untrusted(raw_info[:6000])}

Return JSON:
{{
  "company": "{_untrusted(company)}",
  "industry": "",
  "headquarters": "",
  "approx_size": "",
  "key_products": ["<str>"],
  "recent_initiatives": ["<str>"],
  "interview_culture_notes": "<summary>"

}}"""
            res = await llm_service.llm_json(system, user, tier=tier, _user_id=_user_id, _resource=task.value)
            return {"task_type": task.value, "tier": tier, "result": res}

        if task == SkillTaskType.RESUME_ANALYSIS:
            resume_text = payload.get("resume_text", "")
            jd = payload.get("job_description", "")
            custom_instructions = payload.get("custom_instructions", "")
            res = await llm_service.analyze_resume(resume_text, jd, custom_instructions)
            return {"task_type": task.value, "tier": tier, "result": res}

        if task == SkillTaskType.COVER_LETTER:
            resume_text = payload.get("resume_text", "")
            jd = payload.get("job_description", "")
            company = payload.get("company", "")
            role = payload.get("role", "")
            system = (
                "You write compelling, highly authentic, professional cover letters that "
                "synthesize the candidate's actual achievements with the employer's core needs. "
                "Never fabricate metrics or experiences not in the resume."
                + _UNTRUSTED_INSTRUCTION
            )
            user = f"""Draft a tailored cover letter.
COMPANY: {company}
ROLE: {role}
RESUME:
{_untrusted(resume_text[:6000])}
JOB DESCRIPTION:
{_untrusted(jd[:4000])}
"""
            letter = await llm_service.llm_complete(
                system, user, tier=tier, _user_id=_user_id, _resource=task.value
            )
            return {"task_type": task.value, "tier": tier, "cover_letter": letter}

        if task == SkillTaskType.INTERVIEW_QUESTIONS:
            profile = payload.get("profile_summary", "")
            app_data = payload.get("application", {})
            jd = payload.get("job_description", "")
            res = await llm_service.interview_questions(profile, app_data, jd)
            return {"task_type": task.value, "tier": tier, "result": res}

        if task == SkillTaskType.FIT_MATRIX_DIMENSION:
            dimension = payload.get("dimension", "skills")
            candidate_details = payload.get("candidate_details", "")
            job_requirements = payload.get("job_requirements", "")
            system = "You evaluate a candidate against a specific job dimension." + _UNTRUSTED_INSTRUCTION
            user = f"""Evaluate candidate for dimension '{dimension}'.
CANDIDATE:
{_untrusted(candidate_details[:4000])}
REQUIREMENTS:
{_untrusted(job_requirements[:4000])}

Return JSON:
{{
  "dimension": "{dimension}",
  "score": <int 0-100>,
  "confidence": "high|medium|low",
  "strengths": ["<str>"],
  "gaps": ["<str>"],
  "rationale": "<honest evaluation>"
}}"""
            res = await llm_service.llm_json(system, user, tier=tier, _user_id=_user_id, _resource=task.value)
            return {"task_type": task.value, "tier": tier, "result": res}

        raise ValueError(f"No handler defined for task_type '{task.value}'")


# Singleton instance
_skill_router = SkillRouter()


def get_skill_router() -> SkillRouter:
    """Return singleton SkillRouter instance."""
    return _skill_router


async def route_skill(
    task_type: Union[SkillTaskType, str],
    payload: Dict[str, Any],
    latency_target: Union[LatencyTarget, str] = LatencyTarget.BALANCED,
    headers: Optional[Dict[str, str]] = None,
    _user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Module-level helper to route and execute a skill."""
    return await get_skill_router().route_and_execute(
        task_type=task_type,
        payload=payload,
        latency_target=latency_target,
        headers=headers,
        _user_id=_user_id,
    )


__all__ = [
    "SkillTaskType",
    "LatencyTarget",
    "TASK_BASE_TIERS",
    "SkillRouter",
    "get_skill_router",
    "route_skill",
    "resolve_model_tier",
    "get_routing_info",
    "execute_ats_score",
    "normalize_task_type",
    "normalize_latency_target",
    "extract_latency_target_from_headers",
]
