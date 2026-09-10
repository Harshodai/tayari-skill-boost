"""Skill Gap Radar & Free Resource Engine — Tayari AI Engine.

Compares resume Knowledge Graph skills against target Job Descriptions.
Identifies missing technical & domain skills and attaches curated free learning resources.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.services.skill_taxonomy import extract_skills

logger = logging.getLogger(__name__)

# Free Learning Resources Knowledge Base
FREE_RESOURCE_DIRECTORY = {
    "kubernetes": {"name": "Kubernetes Official Docs & Interactive Tutorials", "url": "https://kubernetes.io/docs/tutorials/", "type": "Documentation"},
    "docker": {"name": "Docker Curriculum & Hands-on Labs", "url": "https://docker-curriculum.com/", "type": "Interactive Course"},
    "system design": {"name": "System Design Primer (GitHub - 250k+ Stars)", "url": "https://github.com/donnemartin/system-design-primer", "type": "GitHub Repo"},
    "graphql": {"name": "How to GraphQL Full Stack Tutorial", "url": "https://www.howtographql.com/", "type": "Free Course"},
    "kafka": {"name": "Apache Kafka Developer Guide & Free Courses", "url": "https://developer.confluent.io/courses/", "type": "Official Academy"},
    "redis": {"name": "Redis University Free Certification", "url": "https://university.redis.com/", "type": "Free Course"},
    "python": {"name": "Real Python Tutorials & Guides", "url": "https://realpython.com/", "type": "Tutorials"},
    "go": {"name": "A Tour of Go & Go by Example", "url": "https://gobyexample.com/", "type": "Interactive Guide"},
    "golang": {"name": "A Tour of Go & Go by Example", "url": "https://gobyexample.com/", "type": "Interactive Guide"},
    "aws": {"name": "AWS Skill Builder Free Learning Plans", "url": "https://explore.skillbuilder.aws/", "type": "Official Training"},
    "gcp": {"name": "Google Cloud Free Tier & Labs", "url": "https://cloud.google.com/free", "type": "Official Training"},
    "react": {"name": "React Official Documentation & Interactive Sandbox", "url": "https://react.dev/learn", "type": "Documentation"},
    "typescript": {"name": "TypeScript Handbook & Executable Playground", "url": "https://www.typescriptlang.org/docs/", "type": "Documentation"},
    "webassembly": {"name": "MDN WebAssembly Guide", "url": "https://developer.mozilla.org/en-US/docs/WebAssembly", "type": "Documentation"},
    "wasm": {"name": "MDN WebAssembly Guide", "url": "https://developer.mozilla.org/en-US/docs/WebAssembly", "type": "Documentation"},
    "playwright": {"name": "Playwright Official Docs", "url": "https://playwright.dev/docs/intro", "type": "Documentation"},
    "canvas": {"name": "MDN Canvas API Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial", "type": "Documentation"},
}


@dataclass
class SkillGapItem:
    skill: str
    category: str  # "technical", "domain", "tools"
    importance: str  # "HIGH", "MEDIUM", "LOW"
    resource_name: str
    resource_url: str
    resource_type: str


def _resource_for(skill: str) -> dict:
    key = skill.lower().strip()
    return FREE_RESOURCE_DIRECTORY.get(
        key,
        {
            "name": f"Free {skill.title()} Guide & Documentation",
            "url": f"https://devdocs.io/#q={key}",
            "type": "DevDocs",
        },
    )


def _format_result(matched: List[str], required: List[str], candidate_canonical: set) -> Dict[str, Any]:
    matched_skills: List[str] = []
    missing_gaps: List[SkillGapItem] = []
    for skill in required:
        key = skill.lower().strip()
        if key in candidate_canonical or any(key in s for s in candidate_canonical):
            matched_skills.append(skill.title())
        else:
            res_info = _resource_for(skill)
            missing_gaps.append(
                SkillGapItem(
                    skill=skill.title(),
                    category="technical",
                    importance="HIGH" if key in ("system design", "kubernetes", "aws", "kafka") else "MEDIUM",
                    resource_name=res_info["name"],
                    resource_url=res_info["url"],
                    resource_type=res_info["type"],
                )
            )

    match_ratio = round(
        (len(matched_skills) / max(len(matched_skills) + len(missing_gaps), 1)) * 100, 1
    )
    return {
        "match_percentage": match_ratio,
        "matched_skills_count": len(matched_skills),
        "missing_gaps_count": len(missing_gaps),
        "matched_skills": matched_skills,
        "missing_gaps": [
            {
                "skill": g.skill,
                "category": g.category,
                "importance": g.importance,
                "resource_name": g.resource_name,
                "resource_url": g.resource_url,
                "resource_type": g.resource_type,
            }
            for g in missing_gaps
        ],
    }


async def _extract_required_skills_llm(job_description: str) -> Optional[List[str]]:
    """Ask the LLM to list ONLY skills/technologies literally stated or
    unambiguously implied in the JD text — grounded extraction, not a fixed
    vocabulary lookup, so a JD requiring WebAssembly/Canvas/Playwright (or
    any other real-world term a static checklist won't have) is actually
    detected. Returns None (not a fabricated empty list) if the LLM is
    unconfigured, so the caller can fall back to the taxonomy extractor.
    """
    from app.services.llm_service import llm_json, LLMNotConfiguredError

    system = (
        "You extract required technical skills from a job description. "
        "List ONLY skills, technologies, tools, or methodologies that are "
        "explicitly named or unambiguously implied by the text. Do not invent "
        "skills the text doesn't support."
    )
    user = f"""Job description:
{job_description[:4000]}

Return JSON: {{"required_skills": ["<short skill/technology name>", ...]}}
Use concise canonical names (e.g. "WebAssembly" not "Wasm-based processing pipeline")."""
    try:
        result = await llm_json(system, user, max_tokens=500)
    except LLMNotConfiguredError:
        return None
    except Exception as exc:  # noqa: BLE001 - LLM extraction is best-effort
        logger.warning("skill_gap_radar: LLM extraction failed (%s)", exc)
        return None
    if isinstance(result, dict):
        skills = result.get("required_skills")
        if isinstance(skills, list):
            return [str(s).strip() for s in skills if str(s).strip()]
    return None


async def analyze_skill_gaps(
    resume_skills: List[str],
    job_description: str,
) -> Dict[str, Any]:
    """Compare candidate skills against target JD and map curated learning resources."""
    jd_text = (job_description or "").lower()
    candidate_skills_lower = set(s.lower().strip() for s in (resume_skills or []))

    # Union the caller-supplied resume_skills with what the taxonomy
    # extractor finds directly in free-text skill strings, so a candidate
    # skill phrased differently than the JD's wording ("JS" vs "javascript")
    # still resolves to the same canonical term on both sides.
    candidate_canonical = set(candidate_skills_lower)
    for s in candidate_skills_lower:
        candidate_canonical |= extract_skills(s)

    required_skills = await _extract_required_skills_llm(job_description or "")
    if required_skills is not None:
        return _format_result([], sorted(set(required_skills)), candidate_canonical)

    # LLM unavailable — fall back to the taxonomy extractor (hundreds of
    # canonical terms, still grounded in the real JD text, just a smaller
    # fixed vocabulary than an LLM read would catch).
    tech_checklist = sorted(extract_skills(jd_text))
    return _format_result([], tech_checklist, candidate_canonical)
