"""Legitimacy checker and Posting Health signal calculator."""
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

LEGITIMACY_SYSTEM_PROMPT = """
You are a career risk analyst. Evaluate the legitimacy and activity of this job posting.
Analyze the following criteria:
1. Description quality (is it highly specific with tools, context, team details, or generic boilerplate?).
2. Seniority consistency (e.g., entry-level title requiring staff-level experience).
3. Realism of requirements (years of experience vs technology release dates).
4. Contextual signals (evergreen vs specific project need).

Respond with a JSON object of this structure:
{
    "legitimacy_tier": "High Confidence" | "Proceed with Caution" | "Suspicious",
    "signals": [
        {
            "signal": "Description specificity",
            "finding": "Contains highly specific technical stacks (e.g. FastAPI, Celery, React)",
            "weight": "Positive" | "Neutral" | "Concerning"
        }
    ],
    "context_notes": "A brief explanation of why this rating was given."
}
"""


def compute_posting_health(job: Dict[str, Any]) -> Dict[str, Any]:
    """Compute deterministic composite Posting Health badge and evidence list."""
    now = datetime.now(timezone.utc)
    evidence: List[Dict[str, str]] = []
    
    # 1. Calculate posting age
    age_days = 0
    posted_raw = job.get("posted_at") or job.get("created_at") or job.get("first_seen")
    if posted_raw:
        try:
            posted_dt = datetime.fromisoformat(str(posted_raw).replace("Z", "+00:00"))
            if posted_dt.tzinfo is None:
                posted_dt = posted_dt.replace(tzinfo=timezone.utc)
            age_days = max((now - posted_dt).days, 0)
        except Exception:
            age_days = 0

    if age_days <= 14:
        evidence.append({"signal": "Age", "detail": f"Fresh posting ({age_days} days old)", "status": "positive"})
    elif age_days <= 45:
        evidence.append({"signal": "Age", "detail": f"Aging posting ({age_days} days old)", "status": "neutral"})
    else:
        evidence.append({"signal": "Age", "detail": f"Stale posting ({age_days} days old)", "status": "concerning"})

    # 2. Source Trust (Official ATS JSON vs scraped)
    source = (job.get("source") or job.get("url") or "").lower()
    is_tier_a = any(ats in source for ats in ["greenhouse", "lever", "ashby", "workday"])
    if is_tier_a:
        evidence.append({"signal": "Source Trust", "detail": "Official ATS JSON source (High Trust)", "status": "positive"})
    else:
        evidence.append({"signal": "Source Trust", "detail": "Aggregated/Scraped job board source", "status": "neutral"})

    # 3. Salary Transparency
    desc = (job.get("description") or "").lower()
    salary = job.get("salary") or ""
    has_salary = bool(salary or "$" in desc or "k/yr" in desc or "salary" in desc)
    if has_salary:
        evidence.append({"signal": "Salary Transparency", "detail": "Salary or compensation details present", "status": "positive"})
    else:
        evidence.append({"signal": "Salary Transparency", "detail": "No compensation details disclosed", "status": "neutral"})

    # 4. Repost count
    raw_repost = job.get("repost_count")
    repost_count = 0 if raw_repost is None else int(raw_repost)
    if repost_count >= 3:
        evidence.append({"signal": "Repost History", "detail": f"Reposted {repost_count} times in recent history", "status": "concerning"})
    elif repost_count == 0:
        evidence.append({"signal": "Repost History", "detail": "First time seen (0 reposts)", "status": "positive"})
    else:
        evidence.append({"signal": "Repost History", "detail": f"Reposted {repost_count} time(s)", "status": "neutral"})

    # 5. Composite Badge Assignment
    concerning_count = sum(1 for e in evidence if e["status"] == "concerning")
    positive_count = sum(1 for e in evidence if e["status"] == "positive")

    if concerning_count >= 2 or age_days > 60 or repost_count >= 4:
        badge = "Likely ghost"
        rank_weight = -0.3
    elif concerning_count == 1 or age_days > 30:
        badge = "Aging"
        rank_weight = -0.05
    elif positive_count >= 2 and age_days <= 14:
        badge = "Fresh"
        rank_weight = 0.15
    else:
        badge = "Fresh"
        rank_weight = 0.0

    return {
        "badge": badge,
        "rank_weight": rank_weight,
        "age_days": age_days,
        "evidence": evidence
    }


async def check_job_legitimacy(title: str, company: str, location: str, description: str) -> dict:
    """Analyze the legitimacy and active status of a job posting."""
    from app.services.llm_service import llm_json
    prompt = f"""
    Evaluate this job listing:
    Title: {title}
    Company: {company}
    Location: {location}
    Description: {description[:4000]}
    """
    
    try:
        res = await llm_json(LEGITIMACY_SYSTEM_PROMPT, prompt, tier="fast")
        if isinstance(res, dict) and "legitimacy_tier" in res:
            return res
    except Exception as exc:
        logger.error("Failed to run legitimacy analysis via LLM: %s", exc)
        
    return {
        "legitimacy_tier": "Proceed with Caution",
        "signals": [
            {
                "signal": "Analysis error",
                "finding": "Legitimacy checker encountered a runtime exception.",
                "weight": "Neutral"
            }
        ],
        "context_notes": "Unable to complete automated legitimacy checks."
    }
