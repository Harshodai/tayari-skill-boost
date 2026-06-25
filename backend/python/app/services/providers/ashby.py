import re
import httpx

INTERVAL_MULTIPLIERS = {
    '1 HOUR': 2080,
    '1 DAY': 260,
    '1 WEEK': 52,
    '2 WEEK': 26,
    '0.5 MONTH': 24,
    '1 MONTH': 12,
    '2 MONTH': 6,
    '3 MONTH': 4,
    '6 MONTH': 2,
    '1 YEAR': 1,
}

def parse_compensation(job: dict) -> dict | None:
    comp = job.get("compensation")
    if not comp:
        return None
    interval = comp.get("interval") or "1 YEAR"
    multiplier = INTERVAL_MULTIPLIERS.get(interval)
    if not multiplier:
        return None
        
    def normalize_num(v):
        if v is None:
            return None
        try:
            n = float(v)
            return n if n >= 0 else None
        except (ValueError, TypeError):
            return None
            
    min_val = normalize_num(comp.get("minValue"))
    max_val = normalize_num(comp.get("maxValue"))
    currency = str(comp.get("currency") or "").strip().upper()
    
    if min_val is None and max_val is None:
        return None
        
    min_ann = min_val * multiplier if min_val is not None else None
    max_ann = max_val * multiplier if max_val is not None else None
    
    if min_ann is None and max_ann is None:
        return None
        
    resolved_min = min_ann if min_ann is not None else max_ann
    resolved_max = max_ann if max_ann is not None else min_ann
    
    return {
        "min": min(resolved_min, resolved_max),
        "max": max(resolved_min, resolved_max),
        "currency": currency
    }

def format_location(j: dict) -> str:
    parts = []
    if isinstance(j.get("location"), str) and j["location"].strip():
        parts.append(j["location"].strip())
    sec = j.get("secondaryLocations")
    if isinstance(sec, list):
        for s in sec:
            if not isinstance(s, dict):
                continue
            if isinstance(s.get("location"), str) and s["location"].strip():
                parts.append(s["location"].strip())
            pa = (s.get("address") or {}).get("postalAddress")
            if isinstance(pa, dict):
                for k in ["addressLocality", "addressCountry"]:
                    if isinstance(pa.get(k), str) and pa[k].strip():
                        parts.append(pa[k].strip())
    # Dedup preserving order
    seen = set()
    deduped = []
    for p in parts:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return " · ".join(deduped)

def resolve_api_url(careers_url: str) -> str | None:
    match = re.search(r'jobs\.ashbyhq\.com/([^/?#]+)', careers_url)
    if not match:
        return None
    return f"https://api.ashbyhq.com/posting-api/job-board/{match.group(1)}?includeCompensation=true"

async def fetch_jobs(company_name: str, careers_url: str) -> list[dict]:
    url = resolve_api_url(careers_url)
    if not url:
        return []
        
    # Ashby requires retry support due to rate-limiting
    last_exc = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(follow_redirects=False) as client:
                r = await client.get(url, timeout=30.0)
                r.raise_for_status()
                data = r.json()
            break
        except Exception as e:
            last_exc = e
            import asyncio
            await asyncio.sleep(1.0 * (2 ** attempt))
    else:
        if last_exc:
            raise last_exc
        return []
        
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    results = []
    for j in jobs:
        results.append({
            "title": j.get("title", ""),
            "url": j.get("jobUrl", ""),
            "company": company_name,
            "location": format_location(j),
            "salary": parse_compensation(j),
            "description": "",
            "posted_at": j.get("publishedAt")
        })
    return results
