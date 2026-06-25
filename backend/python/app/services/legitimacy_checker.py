import logging
from typing import Dict, Any, List
from app.services.llm_service import llm_json

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

async def check_job_legitimacy(title: str, company: str, location: str, description: str) -> dict:
    """Analyze the legitimacy and active status of a job posting."""
    prompt = f"""
    Evaluate this job listing:
    Title: {title}
    Company: {company}
    Location: {location}
    Description: {description[:4000]}
    """
    
    try:
        # Request a structured JSON analysis
        res = await llm_json(LEGITIMACY_SYSTEM_PROMPT, prompt, tier="fast")
        if isinstance(res, dict) and "legitimacy_tier" in res:
            return res
    except Exception as exc:
        logger.error("Failed to run legitimacy analysis via LLM: %s", exc)
        
    # Default fallback if LLM analysis fails
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
