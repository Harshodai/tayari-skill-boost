'''Career Intelligence Engine.

Provides utilities for:
- Skill gap analysis against market demand.
- Salary benchmarking based on role and location.
- Trending skills detection from recent job postings.

These are placeholders; real implementations would query external data sources
(e.g., O*NET, salary APIs, job boards) and combine with user profile data.
'''

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def skill_gap_analysis(user_skills: List[str], target_role: str) -> Dict[str, Any]:
    """Return a simulated skill gap report.

    Args:
        user_skills: List of skill names the user possesses.
        target_role: Desired job title.
    Returns:
        Mapping with missing skills and suggested learning resources.
    """
    # Placeholder mapping for demo purposes
    role_requirements = {
        "Data Scientist": ["Python", "SQL", "Machine Learning", "Statistics"],
        "Backend Engineer": ["Go", "Docker", "PostgreSQL", "REST"],
        "Fullstack Engineer": ["React", "TypeScript", "Node.js", "CSS"],
    }
    required = set(role_requirements.get(target_role, []))
    missing = required.difference(set(user_skills))
    suggestions = {skill: f"Learn {skill} via Coursera/edX" for skill in missing}
    logger.info("Skill gap analysis for %s: %s", target_role, missing)
    return {"target_role": target_role, "missing_skills": list(missing), "suggestions": suggestions}

def salary_benchmark(role: str, location: str) -> Dict[str, Any]:
    """Return a simulated salary range.

    Args:
        role: Job title.
        location: City or region.
    Returns:
        Dictionary with min, median, max salary in USD.
    """
    # Placeholder data – in reality would query a compensation API.
    base = {
        "Data Scientist": 110000,
        "Backend Engineer": 120000,
        "Fullstack Engineer": 115000,
    }.get(role, 100000)
    # Simple location multiplier (e.g., +20% for high cost of living).
    multiplier = 1.2 if location.lower() in ["san francisco", "nyc", "new york"] else 1.0
    median = int(base * multiplier)
    return {"role": role, "location": location, "salary_usd": {"min": int(median * 0.8), "median": median, "max": int(median * 1.2)}}

def trending_skills(limit: int = 10) -> List[Dict[str, Any]]:
    """Return a list of currently trending skills.

    Args:
        limit: Number of top skills to return.
    Returns:
        List of skill dicts with name and popularity score.
    """
    # Simulated trending list – real impl would analyse recent job postings.
    sample = ["AI", "Kubernetes", "Terraform", "Rust", "GraphQL", "TypeScript", "Go", "React"]
    trending = [{"skill": s, "popularity": 100 - i * 5} for i, s in enumerate(sample[:limit])]
    logger.info("Trending skills: %s", trending)
    return trending
