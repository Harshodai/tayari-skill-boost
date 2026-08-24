import json
import logging
from typing import Dict, Any, List
from app.services.db import get_pool
from app.services.llm_service import llm_json

logger = logging.getLogger(__name__)

PATTERN_ANALYSIS_SYSTEM_PROMPT = """
You are a career strategy coach. Analyze this JSON summary of candidate job application outcomes, remote policies, and scores.
Synthesize the data and generate:
1. Recommended score threshold (e.g. "Do not apply below 4.0/5.0 because...").
2. Top 5 actionable recommendations to improve conversion rates (e.g. "Focus on Agentic/LLMOps roles", "Avoid geo-restricted US postings", "Close tech gap in Kubernetes").

Respond with a JSON object of this structure:
{
    "score_threshold_rationale": "Data-driven threshold recommendation and reasoning.",
    "recommendations": [
        {
            "action": "Clear actionable instruction",
            "reasoning": "Data-backed reasoning",
            "impact": "High" | "Medium" | "Low"
        }
    ]
}
"""

async def analyze_rejection_patterns(user_id: str) -> dict:
    """Analyze application history for a user to identify targeting patterns."""
    pool = await get_pool()
    if not pool:
        return {}
        
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT stage, title, company, location, dream_score, review_notes, legitimacy_assessment, evaluation_report
            FROM public.applications
            WHERE user_id = $1
            """,
            user_id
        )
        
    if not rows:
        return {
            "total_analyzed": 0,
            "funnel": {},
            "score_threshold_rationale": "No applications tracked yet.",
            "recommendations": []
        }
        
    # Process rows locally
    total = len(rows)
    funnel = {}
    stage_outcomes = {
        "positive": 0,
        "negative": 0,
        "self_filtered": 0,
        "pending": 0
    }
    
    score_sums = {"positive": 0, "negative": 0, "pending": 0}
    score_counts = {"positive": 0, "negative": 0, "pending": 0}
    
    archetype_stats = {}
    remote_stats = {}
    
    raw_applications_summary = []
    
    for r in rows:
        stage = (r["stage"] or "saved").lower()
        funnel[stage] = funnel.get(stage, 0) + 1
        
        # Outcome classification
        if stage in ["interview", "offer", "responded", "applied"]:
            outcome = "positive"
        elif stage in ["rejected", "discarded"]:
            outcome = "negative"
        elif stage in ["skip", "self-filtered"]:
            outcome = "self_filtered"
        else:
            outcome = "pending"
            
        stage_outcomes[outcome] += 1
        
        # Score mapping
        score = r["dream_score"] or 0
        if score > 0 and outcome in score_sums:
            score_sums[outcome] += score
            score_counts[outcome] += 1
            
        # Parse evaluation report for archetype/remote
        report = {}
        if r["evaluation_report"]:
            try:
                report = json.loads(r["evaluation_report"]) if isinstance(r["evaluation_report"], str) else r["evaluation_report"]
            except Exception:
                pass
                
        archetype = report.get("archetype") or "Unknown"
        remote_policy = (report.get("block_a") or {}).get("remote") or "Unknown"
        
        archetype_stats.setdefault(archetype, {"total": 0, "positive": 0})
        archetype_stats[archetype]["total"] += 1
        if outcome == "positive":
            archetype_stats[archetype]["positive"] += 1
            
        remote_stats.setdefault(remote_policy, {"total": 0, "positive": 0})
        remote_stats[remote_policy]["total"] += 1
        if outcome == "positive":
            remote_stats[remote_policy]["positive"] += 1
            
        raw_applications_summary.append({
            "stage": stage,
            "outcome": outcome,
            "score": score,
            "archetype": archetype,
            "remote_policy": remote_policy,
            "notes": r["review_notes"] or ""
        })
        
    # Calculate averages
    averages = {}
    for k in score_sums:
        cnt = score_counts[k]
        averages[k] = round(score_sums[k] / cnt, 2) if cnt > 0 else 0.0
        
    # Get LLM synthesis for recommendations
    llm_payload = {
        "total_analyzed": total,
        "stage_outcomes": stage_outcomes,
        "score_averages": averages,
        "archetype_stats": archetype_stats,
        "remote_stats": remote_stats,
        "raw_applications": raw_applications_summary[:40] # cap size
    }
    
    try:
        synthesis = await llm_json(PATTERN_ANALYSIS_SYSTEM_PROMPT, json.dumps(llm_payload), tier="fast")
        llm_available = True
    except Exception as exc:
        logger.error("Failed to run pattern analyzer LLM synthesis: %s", exc)
        # ponytail: this used to return a specific, plausible-looking
        # threshold ("Maintain a personal score floor of 4.0") as if it were
        # derived from the candidate's real application data. It was a static
        # fallback presented as personalized analysis. Explicit unavailability
        # instead — the deterministic funnel/averages above are still real.
        synthesis = {"score_threshold_rationale": None, "recommendations": []}
        llm_available = False

    return {
        "llm_available": llm_available,
        "total_analyzed": total,
        "funnel": funnel,
        "outcomes": stage_outcomes,
        "score_averages": averages,
        "archetype_stats": archetype_stats,
        "remote_stats": remote_stats,
        "score_threshold_rationale": synthesis.get("score_threshold_rationale", ""),
        "recommendations": synthesis.get("recommendations", [])
    }
