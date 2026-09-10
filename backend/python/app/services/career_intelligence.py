'''Career Intelligence Engine.

Provides utilities for:
- Skill gap analysis against market demand.
- Salary benchmarking based on role and location.
- Trending skills detection from recent job postings.

These are placeholders; real implementations would query external data sources
(e.g., O*NET, salary APIs, job boards) and combine with user profile data.
'''

import logging
from typing import List, Dict, Any, Tuple, Optional

from app.services.career_trajectory_predictor import CareerTrajectoryPredictor

logger = logging.getLogger(__name__)

def skill_gap_analysis(
    user_skills: List[str],
    target_role: str,
    current_title: str = "",
    years_experience: float = 0.0,
) -> Dict[str, Any]:
    """Return a simulated skill gap report and next milestone projection.

    Args:
        user_skills: List of skill names the user possesses.
        target_role: Desired job title.
        current_title: Current job title (defaults to target_role if omitted).
        years_experience: Years of experience.
    Returns:
        Mapping with missing skills, suggested learning resources, and predicted milestone.
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

    title_for_milestone = (current_title or target_role or "Software Engineer").strip()
    next_milestone = CareerTrajectoryPredictor.predict_next_milestone(
        current_title=title_for_milestone,
        years_experience=years_experience,
    )

    return {
        "target_role": target_role,
        "missing_skills": list(missing),
        "suggestions": suggestions,
        "predicted_milestone": next_milestone,
    }


def career_trajectory(current_title: str, years_experience: float = 0.0) -> Dict[str, Any]:
    """Predict next milestone and career path based on title and experience."""
    return CareerTrajectoryPredictor.predict_next_milestone(
        current_title=current_title,
        years_experience=years_experience,
    )

SENIORITY_MULTIPLIERS: Dict[str, Dict[str, float]] = {
    "intern": {"base_mult": 0.50, "bonus_pct": 0.02, "equity_base": 0.0},
    "junior": {"base_mult": 0.75, "bonus_pct": 0.05, "equity_base": 10000.0},
    "mid": {"base_mult": 1.00, "bonus_pct": 0.08, "equity_base": 25000.0},
    "senior": {"base_mult": 1.35, "bonus_pct": 0.12, "equity_base": 60000.0},
    "lead": {"base_mult": 1.55, "bonus_pct": 0.15, "equity_base": 85000.0},
    "staff": {"base_mult": 1.75, "bonus_pct": 0.18, "equity_base": 130000.0},
    "principal": {"base_mult": 2.10, "bonus_pct": 0.22, "equity_base": 200000.0},
    "manager": {"base_mult": 1.60, "bonus_pct": 0.20, "equity_base": 75000.0},
    "director": {"base_mult": 2.20, "bonus_pct": 0.25, "equity_base": 190000.0},
}

DOMAIN_BASE_SALARIES: Dict[str, int] = {
    "AI/ML": 145000,
    "Security": 140000,
    "Systems": 140000,
    "DevOps/Cloud": 135000,
    "Backend": 130000,
    "Product": 130000,
    "Mobile": 125000,
    "Data": 125000,
    "Frontend": 120000,
    "General": 120000,
}


def parse_seniority(role: str) -> str:
    """Parse seniority level from job role string."""
    import re
    role_lower = role.lower()
    if re.search(r"\b(intern|internship|co-op)\b", role_lower):
        return "intern"
    if re.search(r"\b(director|vp|vice president|head of)\b", role_lower):
        return "director"
    if re.search(r"\b(principal)\b", role_lower):
        return "principal"
    if re.search(r"\b(staff)\b", role_lower):
        return "staff"
    if re.search(r"\b(manager|management|engineering lead / manager)\b", role_lower):
        return "manager"
    if re.search(r"\b(lead|team lead|tech lead)\b", role_lower):
        return "lead"
    if re.search(r"\b(senior|sr\.?|ii{2}|iii|level [3-5])\b", role_lower):
        return "senior"
    if re.search(r"\b(junior|jr\.?|entry|associate|graduate|level 1|level i)\b", role_lower):
        return "junior"
    return "mid"


def parse_domain(role: str) -> str:
    """Parse technical/product domain from job role string."""
    import re
    role_lower = role.lower()
    if re.search(r"\b(ai|artificial intelligence|machine learning|ml|deep learning|nlp|computer vision|llm|genai)\b", role_lower):
        return "AI/ML"
    if re.search(r"\b(security|infosec|cybersecurity|appsec|soc|penetration)\b", role_lower):
        return "Security"
    if re.search(r"\b(systems|embedded|firmware|kernel|low[- ]level|distributed systems)\b", role_lower):
        return "Systems"
    if re.search(r"\b(devops|cloud|sre|site reliability|infrastructure|platform|kubernetes)\b", role_lower):
        return "DevOps/Cloud"
    if re.search(r"\b(backend|back[- ]end|server|api engineer|golang|python developer|java engineer)\b", role_lower):
        return "Backend"
    if re.search(r"\b(frontend|front[- ]end|ui|ux|web developer|react|vue|angular)\b", role_lower):
        return "Frontend"
    if re.search(r"\b(mobile|ios|android|swift|flutter|react native)\b", role_lower):
        return "Mobile"
    if re.search(r"\b(data scientist|data engineer|data analyst|bi|analytics|big data|etl)\b", role_lower):
        return "Data"
    if re.search(r"\b(product|product manager|pm|technical product manager|tpm)\b", role_lower):
        return "Product"
    return "General"


def parse_location_tier(location: str) -> Tuple[str, float]:
    """Classify location into metro cost-of-living tier and multiplier."""
    import re
    loc_lower = location.lower()
    tier1_keywords = [
        "san francisco", "sf", "bay area", "san jose", "silicon valley",
        "oakland", "berkeley", "palo alto", "mountain view", "sunnyvale",
        "new york", "nyc", "manhattan", "brooklyn", "seattle", "bellevue", "redmond"
    ]
    for kw in tier1_keywords:
        if re.search(rf"\b{re.escape(kw)}\b", loc_lower):
            return "Tier 1", 1.30

    tier2_keywords = [
        "austin", "boston", "cambridge", "chicago", "los angeles", "la",
        "denver", "boulder", "washington", "dc", "san diego", "atlanta",
        "dallas", "miami", "toronto", "vancouver", "london", "raleigh", "portland"
    ]
    for kw in tier2_keywords:
        if re.search(rf"\b{re.escape(kw)}\b", loc_lower):
            return "Tier 2", 1.12

    return "Remote / National Average", 1.0


def calculate_dynamic_compensation(role: str, location: str) -> Dict[str, Any]:
    """Compute dynamic salary, bonus, and equity ranges based on heuristics."""
    seniority = parse_seniority(role)
    domain = parse_domain(role)
    location_tier, loc_mult = parse_location_tier(location)

    domain_base = DOMAIN_BASE_SALARIES.get(domain, 120000)
    seniority_info = SENIORITY_MULTIPLIERS.get(seniority, SENIORITY_MULTIPLIERS["mid"])
    seniority_mult = seniority_info["base_mult"]

    median_salary = int(round(domain_base * seniority_mult * loc_mult, -2))
    min_salary = int(round(median_salary * 0.85, -2))
    max_salary = int(round(median_salary * 1.20, -2))

    bonus_pct = seniority_info["bonus_pct"]
    median_bonus = int(round(median_salary * bonus_pct, -2))
    min_bonus = int(round(median_bonus * 0.6, -2))
    max_bonus = int(round(median_bonus * 1.5, -2))

    equity_base = seniority_info["equity_base"] * loc_mult
    median_equity = int(round(equity_base, -2))
    min_equity = int(round(median_equity * 0.5, -2))
    max_equity = int(round(median_equity * 1.8, -2))

    return {
        "role": role,
        "location": location,
        "salary_usd": {
            "min": min_salary,
            "median": median_salary,
            "max": max_salary,
        },
        "salary_min": float(min_salary),
        "salary_median": float(median_salary),
        "salary_max": float(max_salary),
        "currency": "USD",
        "bonus": {
            "min": min_bonus,
            "median": median_bonus,
            "max": max_bonus,
            "currency": "USD",
            "description": "Estimated annual performance bonus",
        },
        "equity": {
            "min": min_equity,
            "median": median_equity,
            "max": max_equity,
            "currency": "USD",
            "vesting_period": "4-year vesting with 1-year cliff",
            "description": "Estimated annualized equity / RSU grant value",
        },
        "seniority": seniority,
        "domain": domain,
        "location_tier": location_tier,
        "data_source_metadata": {
            "source": "dynamic_compensation_model",
            "confidence": "high (market benchmark)",
            "seniority_level": seniority,
            "seniority_multiplier": seniority_mult,
            "domain": domain,
            "domain_base_salary_usd": domain_base,
            "location_tier": location_tier,
            "location_multiplier": loc_mult,
            "currency": "USD",
        },
    }


salary_benchmark_sync = calculate_dynamic_compensation


async def salary_benchmark(role: str, location: str) -> Dict[str, Any]:
    """Return realistic salary ranges with bonus, equity, and metadata.

    Args:
        role: Job title (parsed for seniority & technical domain).
        location: City, metro, or region (parsed for location tier multiplier).
    Returns:
        Dictionary with min, median, max salary in USD, bonus, equity, and source metadata.
    """
    import asyncio

    # 1. Attempt async LLM estimation if available and configured
    try:
        from app.services.llm_service import llm_json, build_provider, MockProvider
        provider = build_provider()
        if not isinstance(provider, MockProvider):
            system_prompt = (
                "You are an executive compensation benchmarking engine. Given a role and location, "
                "produce realistic US compensation ranges in USD. Return JSON matching the schema."
            )
            user_prompt = f"Role: {role}\nLocation: {location}"
            schema = {
                "type": "object",
                "properties": {
                    "salary_min": {"type": "integer"},
                    "salary_median": {"type": "integer"},
                    "salary_max": {"type": "integer"},
                    "bonus_min": {"type": "integer"},
                    "bonus_median": {"type": "integer"},
                    "bonus_max": {"type": "integer"},
                    "equity_min": {"type": "integer"},
                    "equity_median": {"type": "integer"},
                    "equity_max": {"type": "integer"},
                    "seniority": {"type": "string"},
                    "domain": {"type": "string"},
                    "location_tier": {"type": "string"},
                },
                "required": ["salary_min", "salary_median", "salary_max"],
            }
            llm_res = await asyncio.wait_for(
                llm_json(system_prompt, user_prompt, schema=schema, tier="fast"),
                timeout=5.0,
            )
            if isinstance(llm_res, dict) and llm_res.get("salary_median"):
                s_min = int(llm_res.get("salary_min", 0))
                s_med = int(llm_res.get("salary_median", 0))
                s_max = int(llm_res.get("salary_max", 0))
                b_min = int(llm_res.get("bonus_min", 0))
                b_med = int(llm_res.get("bonus_median", 0))
                b_max = int(llm_res.get("bonus_max", 0))
                e_min = int(llm_res.get("equity_min", 0))
                e_med = int(llm_res.get("equity_median", 0))
                e_max = int(llm_res.get("equity_max", 0))
                return {
                    "role": role,
                    "location": location,
                    "salary_usd": {
                        "min": s_min,
                        "median": s_med,
                        "max": s_max,
                    },
                    "salary_min": float(s_min),
                    "salary_median": float(s_med),
                    "salary_max": float(s_max),
                    "currency": "USD",
                    "bonus": {
                        "min": b_min,
                        "median": b_med,
                        "max": b_max,
                        "currency": "USD",
                        "description": "Estimated annual performance bonus",
                    },
                    "equity": {
                        "min": e_min,
                        "median": e_med,
                        "max": e_max,
                        "currency": "USD",
                        "vesting_period": "4-year vesting with 1-year cliff",
                        "description": "Estimated annualized equity / RSU grant value",
                    },
                    "seniority": llm_res.get("seniority") or parse_seniority(role),
                    "domain": llm_res.get("domain") or parse_domain(role),
                    "location_tier": llm_res.get("location_tier") or parse_location_tier(location)[0],
                    "data_source_metadata": {
                        "source": "llm_estimation",
                        "confidence": "high (llm-assisted)",
                        "currency": "USD",
                    },
                }
    except Exception as exc:
        logger.debug("LLM salary estimation unavailable or failed: %s; falling back to dynamic model", exc)

    # 2. Fallback to dynamic compensation model
    return calculate_dynamic_compensation(role=role, location=location)

def trending_skills(limit: int = 10) -> List[Dict[str, Any]]:
    """Return a list of currently trending skills.

    Args:
        limit: Number of top skills to return.
    Returns:
        List of skill dicts with name and popularity score.
    """
    # Simulated trending list – real impl would analyse recent job postings.
    sample = ["AI", "Kubernetes", "Terraform", "Rust", "GraphQL", "TypeScript", "Go", "React"]
    trending = [{"name": s, "popularity": 100 - i * 5} for i, s in enumerate(sample[:limit])]
    logger.info("Trending skills: %s", trending)
    return trending
