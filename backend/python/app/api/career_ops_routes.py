"""FastAPI endpoints for Career-Ops Comprehensive Command Center.
"""
from __future__ import annotations

import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, List
from fastapi import Depends, APIRouter, HTTPException, Header, Body
from app.auth.dependencies import get_current_user
from pydantic import BaseModel, Field, ConfigDict

from app.services import portal_scanner, career_ops_evaluator, pattern_analyzer, followup_tracker
from app.services.db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/career-ops", tags=["career-ops"])

# Helper
def get_required_user_id(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header is required")
    return x_user_id

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class EvaluateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    resume_text: str = ""
    title: str = ""
    company: str = ""
    location: str = ""
    description: str = ""
    application_id: Optional[str] = None

    @classmethod
    def from_mapped(cls, data: dict) -> "EvaluateRequest":
        mapped = {}
        mapped["resume_text"] = data.get("resume_text", "")
        mapped["title"] = data.get("title") or data.get("job_title", "")
        mapped["company"] = data.get("company", "")
        mapped["location"] = data.get("location", "")
        mapped["description"] = data.get("description") or data.get("job_description", "")
        mapped["application_id"] = data.get("application_id")
        return cls.model_construct(**mapped)

class ScanRequest(BaseModel):
    positive_keywords: List[str] = Field(default_factory=list)
    negative_keywords: List[str] = Field(default_factory=list)
    allow_locations: List[str] = Field(default_factory=list)
    block_locations: List[str] = Field(default_factory=list)

class PortalCreateRequest(BaseModel):
    name: str
    careers_url: str
    provider: Optional[str] = None
    enabled: bool = True
    keywords_override: List[str] = Field(default_factory=list)

class PortalUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    name: Optional[str] = None
    careers_url: Optional[str] = None
    keywords_override: Optional[List[str]] = None

class FollowupActionRequest(BaseModel):
    application_id: str
    contact: str
    notes: str

class StoryBankUpdateRequest(BaseModel):
    stories: List[dict]

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/evaluate")
async def evaluate_job(payload: dict = Body(...), x_user_id: str = Depends(get_current_user)):
    parsed = EvaluateRequest.from_mapped(payload)
    user_id = get_required_user_id(x_user_id)
    report = await career_ops_evaluator.evaluate_job_candidate(
        user_id=user_id,
        resume_text=parsed.resume_text,
        title=parsed.title,
        company=parsed.company,
        location=parsed.location,
        description=parsed.description
    )
    
    # Save the report if application_id is provided
    if parsed.application_id:
        pool = await get_pool()
        if pool:
            try:
                # Calculate dream_score out of 5 based on some criteria, or just save evaluation report
                # Let's save report
                report_json = json.dumps(report)
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE public.applications
                        SET evaluation_report = $3::jsonb,
                            legitimacy_assessment = $4::jsonb,
                            dream_score = 4, -- Default default score multiplier
                            updated_at = now()
                        WHERE user_id = $1 AND application_id = $2
                        """,
                        user_id, parsed.application_id, report_json, json.dumps(report.get("block_g", {}))
                    )
            except Exception as exc:
                logger.error("Failed to save evaluation report to DB: %s", exc)
                
    return report

@router.post("/scan")
async def trigger_scan(payload: ScanRequest, x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    jobs = await portal_scanner.scan_portals(
        user_id=user_id,
        positive_keywords=payload.positive_keywords,
        negative_keywords=payload.negative_keywords,
        allow_locations=payload.allow_locations,
        block_locations=payload.block_locations
    )
    return {"jobs": jobs}

@router.get("/patterns")
async def get_patterns(x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    patterns = await pattern_analyzer.analyze_rejection_patterns(user_id)
    return patterns

@router.get("/followups")
async def get_followups(x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    followups = await followup_tracker.track_followup_cadence(user_id)
    return {"followups": followups}

@router.post("/followups/action")
async def action_followup(payload: FollowupActionRequest, x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database unavailable")
        
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT notes_log FROM public.applications WHERE user_id = $1 AND application_id = $2",
            user_id, payload.application_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Application not found")
            
        notes = []
        if row["notes_log"]:
            try:
                notes = json.loads(row["notes_log"]) if isinstance(row["notes_log"], str) else row["notes_log"]
            except Exception:
                pass
                
        # Append new follow-up sent note
        notes.append({
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "text": f"Follow-up sent to {payload.contact}. Notes: {payload.notes}"
        })
        
        await conn.execute(
            """
            UPDATE public.applications
            SET notes_log = $3::jsonb,
                updated_at = now()
            WHERE user_id = $1 AND application_id = $2
            """,
            user_id, payload.application_id, json.dumps(notes)
        )
        
    return {"status": "ok"}

@router.get("/portals")
async def get_portals(x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    portals = await portal_scanner.list_user_portals(user_id)
    return {"portals": portals}

@router.post("/portals")
async def save_portal(payload: PortalCreateRequest, x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    success = await portal_scanner.create_user_portal(
        user_id=user_id,
        name=payload.name,
        careers_url=payload.careers_url,
        provider=payload.provider,
        enabled=payload.enabled,
        keywords_override=payload.keywords_override
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save portal")
    return {"status": "ok"}

@router.delete("/portals/{portal_id}")
async def remove_portal(portal_id: int, x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    success = await portal_scanner.delete_user_portal(user_id, portal_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete portal")
    return {"status": "ok"}

@router.get("/story-bank")
async def get_story_bank(x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database unavailable")
        
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT story_bank FROM public.profiles WHERE id = $1::uuid", user_id)
        if not row or not row["story_bank"]:
            return {"stories": []}
        stories = json.loads(row["story_bank"]) if isinstance(row["story_bank"], str) else row["story_bank"]
        return {"stories": stories}

@router.post("/story-bank")
async def save_story_bank(payload: StoryBankUpdateRequest, x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database unavailable")
        
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE public.profiles SET story_bank = $2::jsonb WHERE id = $1::uuid",
            user_id, json.dumps(payload.stories)
        )
    return {"status": "ok"}

@router.patch("/portals/{portal_id}")
async def update_portal(portal_id: int, payload: PortalUpdateRequest, x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    success = await portal_scanner.update_portal_enabled(user_id, portal_id, payload.enabled)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update portal")
    return {"status": "ok"}

@router.delete("/story-bank/{index}")
async def delete_story(index: int, x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database unavailable")
        
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT story_bank FROM public.profiles WHERE id = $1::uuid", user_id)
        if not row or not row["story_bank"]:
            raise HTTPException(status_code=404, detail="Story bank empty")
        stories = json.loads(row["story_bank"]) if isinstance(row["story_bank"], str) else row["story_bank"]
        if index < 0 or index >= len(stories):
            raise HTTPException(status_code=404, detail="Story index out of range")
        stories.pop(index)
        await conn.execute(
            "UPDATE public.profiles SET story_bank = $2::jsonb WHERE id = $1::uuid",
            user_id, json.dumps(stories)
        )
    return {"status": "ok"}

@router.get("/stats")
async def get_stats(x_user_id: str = Depends(get_current_user)):
    user_id = get_required_user_id(x_user_id)
    stats = await portal_scanner.get_stats(user_id)
    return stats
