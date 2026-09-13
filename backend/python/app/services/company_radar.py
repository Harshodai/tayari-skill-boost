"""Company Radar 15-Minute Job Sentinel — Tayari AI Engine.

Monitors target company career boards on Greenhouse, Lever, and Ashby ATS endpoints.
Emits real-time alerts when new jobs matching target titles are posted (4X callback window).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class RadarJob:
    title: str
    company: str
    location: str
    url: str
    ats_source: str
    posted_at: str = ""
    match_score: float = 0.0


@dataclass
class RadarCheckResult:
    company: str
    jobs_found: List[RadarJob] = field(default_factory=list)
    new_jobs_count: int = 0
    error: Optional[str] = None


async def check_greenhouse_board(company: str, keywords: List[str]) -> RadarCheckResult:
    """Query Greenhouse keyless public JSON API for open jobs."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{company.lower().strip()}/jobs?content=true"
    result = RadarCheckResult(company=company)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                result.error = f"HTTP {resp.status_code}"
                return result

            data = resp.json()
            jobs = data.get("jobs", [])
            for job in jobs:
                title = job.get("title", "")
                job_url = job.get("absolute_url", "")
                loc = (job.get("location") or {}).get("name", "Remote")

                # Keyword match
                if any(re.search(r"\b" + re.escape(kw.lower()) + r"\b", title.lower()) for kwkw in [keywords] for kw in (kwkw if isinstance(kwkw, list) else [kwkw])):
                    result.jobs_found.append(
                        RadarJob(
                            title=title,
                            company=company.title(),
                            location=loc,
                            url=job_url,
                            ats_source="Greenhouse",
                            match_score=0.9,
                        )
                    )
            result.new_jobs_count = len(result.jobs_found)
    except Exception as exc:
        result.error = str(exc)

    return result


async def check_lever_board(company: str, keywords: List[str]) -> RadarCheckResult:
    """Query Lever keyless public JSON API for open jobs."""
    url = f"https://api.lever.co/v0/postings/{company.lower().strip()}?mode=json"
    result = RadarCheckResult(company=company)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                result.error = f"HTTP {resp.status_code}"
                return result

            jobs = resp.json()
            for job in jobs:
                title = job.get("text", "")
                job_url = job.get("hostedUrl", "")
                loc = (job.get("categories") or {}).get("location", "Remote")

                if any(re.search(r"\b" + re.escape(kw.lower()) + r"\b", title.lower()) for kwkw in [keywords] for kw in (kwkw if isinstance(kwkw, list) else [kwkw])):
                    result.jobs_found.append(
                        RadarJob(
                            title=title,
                            company=company.title(),
                            location=loc,
                            url=job_url,
                            ats_source="Lever",
                            match_score=0.85,
                        )
                    )
            result.new_jobs_count = len(result.jobs_found)
    except Exception as exc:
        result.error = str(exc)

    return result


async def monitor_target_companies(
    companies: List[str],
    keywords: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Execute Sentinel scan across target company roster."""
    target_keywords = keywords or ["engineer", "developer", "backend", "frontend", "full stack", "ai", "machine learning", "product manager"]
    all_results = []
    total_new = 0

    for company in companies:
        company_clean = company.strip().lower()
        if not company_clean:
            continue

        # Try Greenhouse first
        gh_res = await check_greenhouse_board(company_clean, target_keywords)
        if gh_res.jobs_found:
            all_results.append(gh_res)
            total_new += gh_res.new_jobs_count
            continue

        # Try Lever fallback
        lever_res = await check_lever_board(company_clean, target_keywords)
        all_results.append(lever_res)
        total_new += lever_res.new_jobs_count

    return {
        "status": "success",
        "companies_scanned": len(companies),
        "total_matches_found": total_new,
        "results": [
            {
                "company": r.company,
                "count": r.new_jobs_count,
                "error": r.error,
                "jobs": [
                    {
                        "title": j.title,
                        "company": j.company,
                        "location": j.location,
                        "url": j.url,
                        "ats_source": j.ats_source,
                    }
                    for j in r.jobs_found
                ],
            }
            for r in all_results
        ],
    }
