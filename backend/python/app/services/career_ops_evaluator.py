import logging
from typing import Any, Dict, List, Optional, Type

from app.llm.long_context import LONG_TEXT_PLACEHOLDER, LongContextClient
from app.services.llm_service import llm_json, llm_complete
from app.services.legitimacy_checker import check_job_legitimacy

logger = logging.getLogger(__name__)


class _ModuleLLM:
    """Adapter binding the client to THIS module's llm globals.

    ponytail: tests stub the module globals (monkeypatch.setattr(career_ops_evaluator,
    "llm_json"/"llm_complete", ...)) — the adapter resolves them at call time so
    the existing deterministic test harness keeps working unchanged.
    """

    async def complete(
        self,
        system_message: str,
        user_message: str,
        *,
        tier: str = "fast",
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str:
        return await llm_complete(
            system_message, user_message, tier=tier, max_tokens=max_tokens, temperature=temperature
        )

    async def json_complete(
        self,
        system_message: str,
        user_message: str,
        *,
        response_model: Optional[Type[Any]] = None,
        tier: str = "fast",
        max_tokens: int = 1500,
    ) -> Any:
        return await llm_json(
            system_message,
            user_message,
            response_model=response_model,
            tier=tier,
            max_tokens=max_tokens,
        )


def _engine_llm() -> LongContextClient:
    return LongContextClient(llm=_ModuleLLM())

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
    # ponytail: chunked via long_context (spec 2026-08-02) — resume reaches the
    # LLM in full through the {LONG_TEXT} slot, JD condenses, instead of
    # [:4000] head-slices.
    jd_condensed = (
        await _engine_llm().condense(description, kind="jd") if description.strip() else ""
    )
    prompt = f"""
    Candidate's Resume Text:
    {LONG_TEXT_PLACEHOLDER}
    
    Job Listing Info:
    Title: {title}
    Company: {company}
    Location: {location}
    Description:
    {jd_condensed}
    """
    
    # ponytail: Blocks A-F used to swallow ANY failure (including an
    # unconfigured LLM) into `eval_data = {}` and return 200 with an empty
    # evaluation — indistinguishable from "the candidate genuinely has no
    # findings" rather than "the evaluation never ran." A missing evaluation
    # must fail loudly, not silently render as a clean report.
    eval_data = await _engine_llm().map_reduce_json(
        resume_text, prompt, kind="resume", system=EVALUATOR_SYSTEM_PROMPT, tier="smart"
    )

    # Run Block G Legitimacy Check
    try:
        legitimacy = await check_job_legitimacy(title, company, location, description)
    except Exception as exc:
        logger.error("Failed Block G legitimacy check: %s", exc)
        # ponytail: "Proceed with Caution" used to be returned as if it were a
        # real signal-derived verdict when the check simply errored. An
        # explicit "Unavailable" tier makes clear this is a missing check, not
        # a judgment the system actually made about this employer.
        legitimacy = {
            "legitimacy_tier": "Unavailable",
            "signals": [],
            "context_notes": "Legitimacy check failed — treat as unverified, not as a safety signal.",
            "check_failed": True,
        }

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
        {LONG_TEXT_PLACEHOLDER}
        
        Job: {title} at {company}
        """
        cover_letter = await _engine_llm().map_reduce(
            resume_text, cover_prompt, kind="resume", max_tokens=600, temperature=0.6, tier="fast"
        )
        eval_data["cover_letter_draft"] = cover_letter.strip()
    except Exception as exc:
        logger.error("Failed to generate cover letter draft: %s", exc)
        eval_data["cover_letter_draft"] = ""
        
    return eval_data
