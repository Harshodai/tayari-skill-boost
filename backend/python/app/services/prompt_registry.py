from __future__ import annotations
"""Versioned prompt registry for the resume optimizer pipeline.

Maps prompt_id -> (version, template, rubric_weights). Prompt text is the
source of truth here; optimizer.py loads from this module so text changes
are versioned in one place.
"""
from app.services.prompt_safety import UNTRUSTED_INSTRUCTION as _UNTRUSTED_INSTRUCTION

_OPTIMIZE_BASE = (
    "You are Tayari's resume optimization engine — a world-class resume writer "
    "who rewrites resumes to maximize ATS scores and recruiter response rates while "
    "staying 100% truthful to the candidate's real experience. Never invent "
    "employers, titles, dates or credentials. You naturally weave in the target "
    "job's keywords where genuinely applicable. Use clean ATS-safe structure: "
    "NAME line first, then ALL-CAPS section headings (PROFESSIONAL SUMMARY, SKILLS, "
    "EXPERIENCE, EDUCATION...), '- ' bullets with action verbs and quantified impact.\n"
    + _UNTRUSTED_INSTRUCTION
)

_HUMANIZE = (
    "You are a professional resume editor specializing in authentic, human-sounding prose. "
    "Your job is to review an AI-optimized resume and remove any patterns that sound "
    "machine-generated or awkward. Rules:\n"
    "- Keep ALL facts, metrics, employer names, dates, and job titles exactly as-is\n"
    "- Fix robotic phrasing: overly formal words, repetitive sentence structures\n"
    "- Fix awkward keyword insertions that break natural sentence flow\n"
    "- Ensure bullets begin with strong, varied action verbs\n"
    "- Make each bullet sound like a real human wrote it\n"
    "Output only the improved resume text, no explanation."
)

_STAR = (
    "You are a career coach specializing in the STAR method (Situation, Task, Action, Result). "
    "Analyze each experience bullet and score its STAR completeness 0-4. "
    "Then rewrite weak bullets to improve STAR coverage using real data the user provided. "
    "NEVER fabricate numbers or experiences. If no metric is available, "
    "suggest a reasonable range like '~20-30%' and mark it with [ESTIMATE]. "
    "Output JSON only — no prose."
)

_REGISTRY: dict[str, dict] = {
    "optimizer.generate": {
        "version": "1.0.0",
        "template": _OPTIMIZE_BASE,
        "rubric_weights": {"ats_coverage": 0.4, "truthfulness": 0.4, "readability": 0.2},
    },
    # ponytail: same text as generate today (refine pass uses OPTIMIZE_SYSTEM);
    # separate id so the two can diverge without a code change.
    "optimizer.reflexion_refine": {
        "version": "1.0.0",
        "template": _OPTIMIZE_BASE,
        "rubric_weights": {"ats_coverage": 0.5, "truthfulness": 0.4, "readability": 0.1},
    },
    "optimizer.humanize": {
        "version": "1.0.0",
        "template": _HUMANIZE,
    },
    "optimizer.star_rewrite": {
        "version": "1.0.0",
        "template": _STAR,
    },
}

_ALIASES = {
    "optimizer.reflexion-refine": "optimizer.reflexion_refine",
}


def _canonical(prompt_id: str) -> str:
    return _ALIASES.get(prompt_id, prompt_id)


def get_prompt(prompt_id: str) -> tuple[str, str]:
    """Return (version, template) for a registered prompt_id."""
    entry = _REGISTRY.get(_canonical(prompt_id))
    if entry is None:
        raise KeyError(f"unknown prompt_id: {prompt_id}")
    return entry["version"], entry["template"]


def render(prompt_id: str, **vars: object) -> str:
    """Render a prompt template, substituting {vars}."""
    _, template = get_prompt(prompt_id)
    if not vars:
        return template
    return template.format(**vars)


def list_prompts() -> dict[str, str]:
    """Return {prompt_id: version} for all registered prompts."""
    return {pid: entry["version"] for pid, entry in _REGISTRY.items()}
