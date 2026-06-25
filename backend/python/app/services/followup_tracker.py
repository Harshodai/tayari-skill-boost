import logging
import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from app.services.db import get_pool
from app.services.llm_service import llm_complete

logger = logging.getLogger(__name__)

FOLLOWUP_PROMPT_TEMPLATE = """
Write a polite, warm, and highly professional follow-up email from a job candidate.
Follow these rules:
- Length: 3-4 sentences max, under 150 words.
- Specifics: Reference the role "{role}" and the company "{company}" specifically.
- Clichés: NEVER use desperate clichés like "just checking in", "just following up", "touching base", or "circling back".
- Content: Include a concrete achievement or value point relevant to the job.
- Call to Action: Direct but soft ask for scheduling or timeline updates.
- Tone: Natural, senior, warm (use contractions, varied sentence lengths).

Job Details:
Role: {role}
Company: {company}
Match Summary: {match_summary}
"""

async def track_followup_cadence(user_id: str) -> list[dict]:
    """Identify applications requiring follow-ups and generate drafts for them."""
    pool = await get_pool()
    if not pool:
        return []
        
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, application_id, stage, title, company, location, updated_at, evaluation_report, notes_log
            FROM public.applications
            WHERE user_id = $1 AND stage IN ('applied', 'responded', 'interview')
            """,
            user_id
        )
        
    now = datetime.now(timezone.utc)
    actionable_apps = []
    
    for r in rows:
        stage = (r["stage"] or "applied").lower()
        updated_at = r["updated_at"]
        age_days = (now - updated_at).days
        
        # Parse notes_log to get previous follow-up count
        notes = []
        if r["notes_log"]:
            try:
                notes = json.loads(r["notes_log"]) if isinstance(r["notes_log"], str) else r["notes_log"]
            except Exception:
                pass
                
        followups_sent = sum(1 for n in notes if isinstance(n, dict) and "follow-up" in str(n.get("text", "")).lower())
        
        urgency = "waiting"
        reason = ""
        
        if stage == "applied":
            if age_days >= 7:
                urgency = "overdue"
                reason = "7+ days since application with no response."
        elif stage == "responded":
            if age_days >= 3:
                urgency = "urgent"
                reason = "3+ days since company responded, action required."
        elif stage == "interview":
            if age_days >= 1:
                urgency = "urgent"
                reason = "Interview completed. Send thank-you note."
                
        if followups_sent >= 2:
            urgency = "cold"
            reason = "2+ follow-ups sent with no reply. Recommend closing."
            
        # Parse match summary from evaluation report if available
        match_summary = "Technical match on key competencies."
        if r["evaluation_report"]:
            try:
                rep = json.loads(r["evaluation_report"]) if isinstance(r["evaluation_report"], str) else r["evaluation_report"]
                match_summary = (rep.get("block_b") or {}).get("gaps", {} or "No major blockers detected.")
            except Exception:
                pass
                
        # Generate draft if overdue/urgent
        draft_subject = ""
        draft_body = ""
        if urgency in ["overdue", "urgent"]:
            prompt = FOLLOWUP_PROMPT_TEMPLATE.format(
                role=r["title"],
                company=r["company"],
                match_summary=str(match_summary)
            )
            try:
                draft_body = await llm_complete(prompt, max_tokens=250, temperature=0.6, tier="fast")
                draft_body = draft_body.strip()
                draft_subject = f"Re: {r['title']} application — {r['company']}"
            except Exception as exc:
                logger.error("Failed to generate follow-up draft: %s", exc)
                
        actionable_apps.append({
            "id": r["id"],
            "application_id": str(r["application_id"]),
            "company": r["company"],
            "role": r["title"],
            "stage": r["stage"],
            "age_days": age_days,
            "followups_sent": followups_sent,
            "urgency": urgency,
            "reason": reason,
            "draft_subject": draft_subject,
            "draft_body": draft_body
        })
        
    return actionable_apps
