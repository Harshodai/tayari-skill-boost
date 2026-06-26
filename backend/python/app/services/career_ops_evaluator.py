import logging
from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_json, llm_complete
from app.services.legitimacy_checker import check_job_legitimacy

logger = logging.getLogger(__name__)

EVALUATOR_SYSTEM_PROMPT = """
You are Career-Ops matching agent. Evaluate this candidate's CV against the Job Description (JD).
Perform a multi-block evaluation:
- Step 0: Archetype Detection (classify job into one of: FDE, SA, PM, LLMOps, Agentic, Transformation).
- Block A: Role Summary (archetype, domain, function, seniority, remote, team size, TL;DR).
- Block B: Match with CV (requirement mapped to CV line, gaps, mitigation plans).
- Block C: Seniority Strategy ("sell senior without lying", "if they downlevel me").
- Block D: Comp and Demand (salary estimation and trends).
- Block E: CV & LinkedIn Customization (Summary proposed change, top 5 changes).
- Block F: STAR+R Stories (Situation, Task, Action, Result, Reflection).

Respond with a JSON object of this structure:
{
    "archetype": "FDE" | "SA" | "PM" | "LLMOps" | "Agentic" | "Transformation",
    "block_a": {
        "domain": "e.g. LLMOps",
        "function": "e.g. Build",
        "seniority": "e.g. Senior",
        "remote": "e.g. Remote",
        "team_size": "e.g. 5 developers",
        "tldr": "A 1-sentence summary of the job."
    },
    "block_b": {
        "mappings": [
            {
                "requirement": "Job requirement text",
                "cv_mapping": "CV line mapping"
            }
        ],
        "gaps": [
            {
                "gap": "Description of the gap",
                "importance": "Hard blocker" | "Nice-to-have",
                "mitigation": "How to address this gap"
            }
        ]
    },
    "block_c": {
        "level_detected": "Level in JD vs candidate's level",
        "sell_senior_plan": "Strategy to present senior achievements",
        "downlevel_plan": "Response strategy if downleveling is proposed"
    },
    "block_d": {
        "comp_estimate": "Estimated base and OTE",
        "demand_trend": "Job category demand trend"
    },
    "block_e": {
        "cv_changes": [
            {
                "section": "e.g. Summary",
                "current": "current summary",
                "proposed": "proposed summary",
                "reason": "why this change"
            }
        ]
    },
    "block_f": {
        "stories": [
            {
                "requirement": "JD requirement",
                "situation": "S",
                "task": "T",
                "action": "A",
                "result": "R",
                "reflection": "Senior learning reflection"
            }
        ]
    }
}
"""

async def evaluate_job_candidate(
    user_id: str,
    resume_text: str,
    title: str,
    company: str,
    location: str,
    description: str
) -> dict:
    """Run the full Career-Ops A-G evaluation pipeline."""
    prompt = f"""
    Candidate's Resume Text:
    {resume_text[:4000]}
    
    Job Listing Info:
    Title: {title}
    Company: {company}
    Location: {location}
    Description:
    {description[:4000]}
    """
    
    try:
        # Run Blocks A-F via LLM
        eval_data = await llm_json(EVALUATOR_SYSTEM_PROMPT, prompt, tier="smart")
    except Exception as exc:
        logger.error("Failed Blocks A-F Career-Ops evaluation: %s", exc)
        eval_data = {}
        
    # Run Block G Legitimacy Check
    try:
        legitimacy = await check_job_legitimacy(title, company, location, description)
    except Exception as exc:
        logger.error("Failed Block G legitimacy check: %s", exc)
        legitimacy = {"legitimacy_tier": "Proceed with Caution", "signals": [], "context_notes": ""}
        
    eval_data["block_g"] = legitimacy
    
    # Generate Cover Letter Draft (Career-Ops style)
    try:
        cover_prompt = f"""
        Write a draft cover letter based on the candidate's resume and job details.
        Follow these rules:
        - Limit to 3-4 paragraphs.
        - Warm, conversational, human tone (use contractions, direct soft-ask, varied rhythm).
        - NEVER use generic clichés like "just checking in", "touching base", or "circling back".
        - Focus on matching achievements and concrete metrics.
        - Highlight gaps (if any) honestly.
        
        Resume:
        {resume_text[:2000]}
        
        Job: {title} at {company}
        """
        cover_letter = await llm_complete("", cover_prompt, max_tokens=600, temperature=0.6, tier="fast")
        eval_data["cover_letter_draft"] = cover_letter.strip()
    except Exception as exc:
        logger.error("Failed to generate cover letter draft: %s", exc)
        eval_data["cover_letter_draft"] = ""
        
    return eval_data
