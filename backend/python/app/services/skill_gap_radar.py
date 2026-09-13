"""Skill Gap Radar & Free Resource Engine — Tayari AI Engine.

Compares resume Knowledge Graph skills against target Job Descriptions.
Identifies missing technical & domain skills and attaches curated free learning resources.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

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
}


@dataclass
class SkillGapItem:
    skill: str
    category: str  # "technical", "domain", "tools"
    importance: str  # "HIGH", "MEDIUM", "LOW"
    resource_name: str
    resource_url: str
    resource_type: str


async def analyze_skill_gaps(
    resume_skills: List[str],
    job_description: str,
) -> Dict[str, Any]:
    """Compare candidate skills against target JD and map curated learning resources."""
    jd_text = (job_description or "").lower()
    candidate_skills_lower = set(s.lower().strip() for s in (resume_skills or []))

    # Common technology keywords to check in JD
    tech_checklist = [
        "kubernetes", "docker", "system design", "graphql", "kafka", "redis",
        "python", "go", "golang", "aws", "gcp", "react", "typescript", "postgres", "sql", "ci/cd"
    ]

    matched_skills = []
    missing_gaps = []

    for tech in tech_checklist:
        if tech in jd_text:
            if tech in candidate_skills_lower or any(tech in s for s in candidate_skills_lower):
                matched_skills.append(tech.title())
            else:
                res_info = FREE_RESOURCE_DIRECTORY.get(
                    tech,
                    {
                        "name": f"Free {tech.title()} Guide & Documentation",
                        "url": f"https://devdocs.io/#q={tech}",
                        "type": "DevDocs",
                    },
                )
                missing_gaps.append(
                    SkillGapItem(
                        skill=tech.title(),
                        category="technical",
                        importance="HIGH" if tech in ["system design", "kubernetes", "aws", "kafka"] else "MEDIUM",
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
