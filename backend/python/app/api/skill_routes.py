"""Skill-gap analysis endpoints.

``POST /api/v1/skill-gaps`` — given a job description and the user's resume
text, returns the role's required skills, the skills the user already has, and
the top-N missing skills (gaps) ranked by how directly the JD names them.

Reuses ``skill_taxonomy`` (canonical skill extraction + adjacency expansion).
No LLM, no embeddings, no DB — the taxonomy set-difference is the honest
minimal gap list. Embeddings would only re-rank what the taxonomy already
separates; add them if gap relevance measurably under-ranks niche skills.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.skill_taxonomy import extract_skills, expand_skills

skill_router = APIRouter(prefix="/api/v1", tags=["skill-gaps"])

# --- Constants (single source of truth) ------------------------------------
MAX_GAPS = 3          # ponytail: top-N surfaced in the widget; tune to pane height
GAP_SLUG_JOIN = "-"   # roadmap node id = lowercased skill, spaces → join char


class SkillGapRequest(BaseModel):
    """Body for ``POST /api/v1/skill-gaps``."""

    job_description: str = Field(..., min_length=1)
    resume_text: str = ""  # optional: empty → every role skill is a gap


class SkillGap(BaseModel):
    """One missing skill + its CareerRoadmap node id (ISP: focused response unit)."""

    skill: str
    directly_required: bool  # True = named verbatim in JD; False = only via expansion
    roadmap_node_id: str


class SkillGapResult(BaseModel):
    role_skills: List[str]
    user_skills: List[str]
    gaps: List[SkillGap]
    overlap_score: float  # 0..1, taxonomy_overlap-style coverage of role by user


# --- Analyzer (SRP: pure gap computation, no I/O) --------------------------
class SkillGapAnalyzer:
    """Compute missing skills from a JD vs a resume using the skill taxonomy.

    Ranking: skills the JD names verbatim (``directly_required=True``) outrank
    skills that only surface via adjacency expansion. Within each tier, sort
    alphabetically for deterministic output. OCP: the two-tier ranking is data
    (the ``directly_required`` flag), not a branching strategy.
    """

    @staticmethod
    def analyze(job_description: str, resume_text: str) -> SkillGapResult:
        jd_exact = extract_skills(job_description)            # verbatim JD skills
        role_skills = expand_skills(jd_exact)                 # + adjacency
        user_skills = expand_skills(extract_skills(resume_text)) if resume_text else set()

        missing = role_skills - user_skills
        direct = sorted(missing & jd_exact)
        adjacent = sorted(missing - jd_exact)

        ranked = (
            [SkillGap(skill=s, directly_required=True, roadmap_node_id=_slug(s))
             for s in direct]
            + [SkillGap(skill=s, directly_required=False, roadmap_node_id=_slug(s))
               for s in adjacent]
        )
        gaps = ranked[:MAX_GAPS]

        overlap = (len(role_skills) - len(missing)) / max(len(role_skills), 1)
        return SkillGapResult(
            role_skills=sorted(role_skills),
            user_skills=sorted(user_skills),
            gaps=gaps,
            overlap_score=round(overlap, 3),
        )


def _slug(skill: str) -> str:
    """Roadmap node id convention: lowercase skill, whitespace → '-'. """
    return skill.lower().replace(" ", GAP_SLUG_JOIN)


@skill_router.post("/skill-gaps", response_model=SkillGapResult)
async def get_skill_gaps(req: SkillGapRequest) -> SkillGapResult:
    """Thin handler — delegates all computation to ``SkillGapAnalyzer``."""
    return SkillGapAnalyzer.analyze(req.job_description, req.resume_text)