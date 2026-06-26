import asyncio
import logging
import re
from typing import Dict, Any, List, Optional
from app.services.db import get_pool
from app.services.providers import PROVIDERS

logger = logging.getLogger(__name__)

# Compile keyword pattern (with word boundaries for 2-3 letter acronyms)
def compile_keyword(kw: str):
    kw_clean = kw.strip().lower()
    if re.match(r'^[a-z]{2,3}$', kw_clean):
        pattern = re.compile(rf'\b{re.escape(kw_clean)}\b', re.IGNORECASE)
        return lambda text: bool(pattern.search(text))
    return lambda text: kw_clean in text.lower()

def match_title(title: str, positive_keywords: List[str], negative_keywords: List[str]) -> bool:
    title_lower = title.lower()
    
    # Negative filters take priority
    if negative_keywords:
        neg_matchers = [compile_keyword(k) for k in negative_keywords]
        if any(m(title_lower) for m in neg_matchers):
            return False
            
    # Positive filters
    if positive_keywords:
        pos_matchers = [compile_keyword(k) for k in positive_keywords]
        return any(m(title_lower) for m in pos_matchers)
        
    return True

def match_location(location: str, allow: List[str], block: List[str], always_allow: List[str] = None) -> bool:
    if not location or not location.strip():
        return True # pass empty locations defensively
        
    loc_lower = location.lower()
    
    # 1. always_allow wins first
    if always_allow:
        if any(a.lower() in loc_lower for a in always_allow):
            return True
            
    # 2. block rejects
    if block:
        if any(b.lower() in loc_lower for b in block):
            return False
            
    # 3. allow allows
    if allow:
        return any(a.lower() in loc_lower for a in allow)
        
    return True

def auto_detect_provider(careers_url: str) -> str | None:
    url_lower = careers_url.lower()
    if 'greenhouse.io' in url_lower:
        return 'greenhouse'
    if 'lever.co' in url_lower:
        return 'lever'
    if 'ashbyhq.com' in url_lower:
        return 'ashby'
    if 'myworkdayjobs.com' in url_lower or 'wd5.myworkdayjobs' in url_lower:
        return 'workday'
    if 'bamboohr.com' in url_lower or 'bamboohr' in url_lower:
        return 'bamboohr'
    if 'taleo.net' in url_lower or 'oracle.com/taleo' in url_lower:
        return 'taleo'
    if 'icims.com' in url_lower:
        return 'icims'
    if 'smartrecruiters.com' in url_lower:
        return 'smartrecruiters'
    if 'successfactors.com' in url_lower or 'sap.com/careers' in url_lower:
        return 'successfactors'
    if 'oracle.com/careers' in url_lower or 'oraclecloud.com' in url_lower:
        return 'oracle'
    if 'brassring.com' in url_lower:
        return 'brassring'
    if 'jobvite.com' in url_lower:
        return 'jobvite'
    if 'kenexa.com' in url_lower or 'ibm.com/employment' in url_lower:
        return 'kenexa'
    if 'ultipro.com' in url_lower or 'ukg.com' in url_lower:
        return 'ukg'
    if 'paylocity.com' in url_lower:
        return 'paylocity'
    if 'ceipal.com' in url_lower:
        return 'ceipal'
    if 'fountain.com' in url_lower:
        return 'fountain'
    return None


def detect_ats_from_job_url(job_url: str) -> str | None:
    if not job_url:
        return None
    return auto_detect_provider(job_url)


def detect_ats_from_company_domain(domain: str) -> str | None:
    if not domain:
        return None
    return auto_detect_provider(f"https://{domain}")


# Known company → ATS provider mapping. Useful when only the company name
# is available (e.g. from free job boards) without a career page URL.
# Sources: career page redirects, public ATS detection databases.
KNOWN_COMPANY_ATS: dict[str, str] = {
    # Greenhouse
    "airbnb": "greenhouse", "coinbase": "greenhouse", "stripe": "greenhouse",
    "datadog": "greenhouse", "instacart": "greenhouse", "pinterest": "greenhouse",
    "spotify": "greenhouse", "lyft": "greenhouse", "brex": "greenhouse",
    "reddit": "greenhouse", "doordash": "greenhouse", "figma": "greenhouse",
    "notion": "greenhouse", "vercel": "greenhouse", "monzo": "greenhouse",
    "revolut": "greenhouse", "intercom": "greenhouse", "twilio": "greenhouse",
    "godaddy": "greenhouse",
    # Lever
    "netflix": "lever", "buffer": "lever", "linear": "lever",
    "hashicorp": "lever", "confluent": "lever", "amplitude": "lever",
    "deel": "lever", "fastly": "lever", "webflow": "lever",
    # Workday
    "target": "workday", "walmart": "workday", "jpmorgan": "workday",
    "jpmorgan chase": "workday", "goldman sachs": "workday", "morgan stanley": "workday",
    "citi": "workday", "wells fargo": "workday", "bank of america": "workday",
    "amazon": "workday", "microsoft": "workday",
    # Taleo / Oracle
    "oracle": "taleo", "hp": "taleo", "hewlett packard": "taleo",
    "ford": "taleo", "fedex": "taleo", "boeing": "taleo",
    # iCIMS
    "united airlines": "icims", "delta": "icims", "marriott": "icims",
    "hilton": "icims", "cvs": "icims", "cvs health": "icims",
    # SuccessFactors
    "sap": "successfactors", "siemens": "successfactors", "bmw": "successfactors",
    "audi": "successfactors", "mercedes": "successfactors", "daimler": "successfactors",
    "adidas": "successfactors", "cisco": "successfactors",
    # Brassring / Kenexa (IBM)
    "ibm": "kenexa", "northrop grumman": "brassring",
    # UKG / Kronos / Ultipro
    "home depot": "ukg", "lowes": "ukg",
    # BambooHR
    "mailchimp": "bamboohr", "zendesk": "bamboohr",
}


def detect_ats_from_company_name(company: str) -> str | None:
    if not company:
        return None
    key = company.strip().lower()
    if key in KNOWN_COMPANY_ATS:
        return KNOWN_COMPANY_ATS[key]
    for name, ats in KNOWN_COMPANY_ATS.items():
        if name in key:
            return ats
    return None


async def annotate_jobs_with_ats(jobs: list[dict]) -> list[dict]:
    for job in jobs:
        ats = None
        if job.get("url"):
            ats = detect_ats_from_job_url(job["url"])
        if not ats and job.get("company"):
            ats = detect_ats_from_company_name(job["company"])
        if ats:
            job["ats_provider"] = ats
    return jobs


async def list_user_portals(user_id: str) -> list[dict]:
    pool = await get_pool()
    if not pool:
        return []
    import json
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, user_id, name, careers_url, provider, enabled, keywords_override FROM user_portals WHERE user_id = $1",
            user_id
        )
        portals = []
        for r in rows:
            d = dict(r)
            kw = d.get("keywords_override")
            if isinstance(kw, str):
                try:
                    d["keywords_override"] = json.loads(kw)
                except Exception:
                    d["keywords_override"] = []
            portals.append(d)
        return portals

async def create_user_portal(user_id: str, name: str, careers_url: str, provider: str = None, enabled: bool = True, keywords_override: list = None) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    import json
    prov = provider or auto_detect_provider(careers_url) or 'greenhouse'
    keywords_json = json.dumps(keywords_override or [])
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_portals (user_id, name, careers_url, provider, enabled, keywords_override)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                ON CONFLICT (user_id, name) DO UPDATE SET
                    careers_url = EXCLUDED.careers_url,
                    provider = EXCLUDED.provider,
                    enabled = EXCLUDED.enabled,
                    keywords_override = EXCLUDED.keywords_override,
                    updated_at = now()
                """,
                user_id, name, careers_url, prov, enabled, keywords_json
            )
        return True
    except Exception as exc:
        logger.error("Failed to save user portal: %s", exc)
        return False

async def delete_user_portal(user_id: str, portal_id: int) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM user_portals WHERE user_id = $1 AND id = $2", user_id, portal_id)
        return True
    except Exception as exc:
        logger.error("Failed to delete user portal: %s", exc)
        return False

async def update_portal_enabled(user_id: str, portal_id: int, enabled: Optional[bool]) -> bool:
    if enabled is None:
        return True  # No change needed
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE user_portals SET enabled = $3, updated_at = now() WHERE user_id = $1 AND id = $2",
                user_id, portal_id, enabled
            )
        return True
    except Exception as exc:
        logger.error("Failed to update portal enabled status: %s", exc)
        return False

async def get_stats(user_id: str) -> dict:
    """Get summary stats for the Career-Ops dashboard."""
    pool = await get_pool()
    if not pool:
        return {
            "portals_active": 0,
            "jobs_discovered_today": 0,
            "followups_pending": 0,
            "funnel_conversion": 0.0
        }
    
    try:
        async with pool.acquire() as conn:
            # Active portals count
            portals_row = await conn.fetchrow(
                "SELECT COUNT(*) as count FROM user_portals WHERE user_id = $1 AND enabled = true",
                user_id
            )
            portals_active = portals_row["count"] if portals_row else 0
            
            # Jobs discovered today (from saved_jobs)
            jobs_row = await conn.fetchrow(
                "SELECT COUNT(*) as count FROM saved_jobs WHERE user_id = $1 AND saved_at >= now() - interval '24 hours'",
                user_id
            )
            jobs_discovered_today = jobs_row["count"] if jobs_row else 0
            
            # Follow-ups pending (applications needing follow-up)
            followups_row = await conn.fetchrow(
                """
                SELECT COUNT(*) as count FROM applications 
                WHERE user_id = $1 
                AND status IN ('applied', 'interviewing', 'phone_screen', 'technical_interview')
                AND (followup_due_at IS NULL OR followup_due_at <= now())
                """,
                user_id
            )
            followups_pending = followups_row["count"] if followups_row else 0
            
            # Funnel conversion: Applied -> Offer
            funnel_row = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'applied') as applied,
                    COUNT(*) FILTER (WHERE status = 'offer') as offers
                FROM applications 
                WHERE user_id = $1
                """,
                user_id
            )
            applied = funnel_row["applied"] if funnel_row else 0
            offers = funnel_row["offers"] if funnel_row else 0
            funnel_conversion = round((offers / applied * 100) if applied > 0 else 0.0, 1)
            
            return {
                "portals_active": portals_active,
                "jobs_discovered_today": jobs_discovered_today,
                "followups_pending": followups_pending,
                "funnel_conversion": funnel_conversion
            }
    except Exception as exc:
        logger.error("Failed to get stats: %s", exc)
        return {
            "portals_active": 0,
            "jobs_discovered_today": 0,
            "followups_pending": 0,
            "funnel_conversion": 0.0
        }

async def scan_portals(user_id: str, positive_keywords: List[str] = None, negative_keywords: List[str] = None, allow_locations: List[str] = None, block_locations: List[str] = None) -> list[dict]:
    """Scan all active portals for a user, filtering and deduping discovered jobs."""
    portals = await list_user_portals(user_id)
    active_portals = [p for p in portals if p.get("enabled")]
    
    if not active_portals:
        return []
        
    # Get existing job URLs to prevent duplicates
    pool = await get_pool()
    if not pool:
        return []
        
    async with pool.acquire() as conn:
        saved_rows = await conn.fetch("SELECT job_url FROM applications WHERE user_id = $1 UNION SELECT dedupe_key FROM saved_jobs WHERE user_id = $1", user_id)
        existing_urls = {r["job_url"] for r in saved_rows if r.get("job_url")}
        
    discovered_jobs = []
    
    async def scan_single_portal(portal):
        prov_id = portal.get("provider") or auto_detect_provider(portal["careers_url"])
        if not prov_id or prov_id not in PROVIDERS:
            logger.warning("No valid provider resolved for portal: %s", portal["name"])
            return
            
        provider = PROVIDERS[prov_id]
        try:
            jobs = await provider.fetch_jobs(portal["name"], portal["careers_url"])
            for j in jobs:
                url = j["url"]
                if url in existing_urls:
                    continue
                    
                # Title filters
                override_kw = portal.get("keywords_override")
                pos_kw = override_kw if override_kw else (positive_keywords or [])
                if not match_title(j["title"], pos_kw, negative_keywords or []):
                    continue
                    
                # Location filters
                if not match_location(j["location"], allow_locations or [], block_locations or []):
                    continue
                    
                discovered_jobs.append(j)
        except Exception as exc:
            logger.error("Failed to scan portal %s: %s", portal["name"], exc)
            
    # Run scans concurrently
    await asyncio.gather(*(scan_single_portal(p) for p in active_portals))
    
    # Save newly discovered jobs as "saved" status in saved_jobs
    if discovered_jobs:
        import json
        async with pool.acquire() as conn:
            for dj in discovered_jobs:
                try:
                    await conn.execute(
                        """
                        INSERT INTO saved_jobs (user_id, dedupe_key, job, status)
                        VALUES ($1, $2, $3::jsonb, 'saved')
                        ON CONFLICT (user_id, dedupe_key) DO NOTHING
                        """,
                        user_id,
                        dj["url"],
                        json.dumps({
                            "title": dj["title"],
                            "company": dj["company"],
                            "location": dj["location"],
                            "url": dj["url"],
                            "description": dj.get("description", ""),
                            "posted_at": dj.get("posted_at")
                        })
                    )
                except Exception as exc:
                    logger.error("Failed to save discovered job %s: %s", dj["url"], exc)
                    
    return discovered_jobs
