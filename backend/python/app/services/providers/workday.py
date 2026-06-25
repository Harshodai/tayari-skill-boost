import re
from datetime import datetime, timezone
import httpx

PAGE_SIZE = 20
MAX_PAGES = 50

def resolve_endpoint(careers_url: str) -> dict | None:
    m = re.match(r'^https://([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([^/?#]+)', careers_url)
    if not m:
        return None
    tenant, instance, site = m.groups()
    origin = f"https://{tenant}.{instance}.myworkdayjobs.com"
    return {
        "api": f"{origin}/wday/cxs/{tenant}/{site}/jobs",
        "jobBase": f"{origin}/{site}"
    }

def parse_posted_on(label: str) -> float | None:
    if not label:
        return None
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    if re.search(r'posted\s+today', label, re.IGNORECASE):
        return now_ms
    if re.search(r'posted\s+yesterday', label, re.IGNORECASE):
        return now_ms - 86400000
    m = re.search(r'posted\s+(\d+)(\+?)\s*day', label, re.IGNORECASE)
    if not m or m.group(2) == '+':
        return None  # Unbounded "30+ Days Ago"
    return now_ms - int(m.group(1)) * 86400000

async def fetch_jobs(company_name: str, careers_url: str) -> list[dict]:
    ep = resolve_endpoint(careers_url)
    if not ep:
        return []
        
    jobs = []
    headers = {
        "content-type": "application/json",
        "accept": "application/json"
    }
    
    async with httpx.AsyncClient(follow_redirects=False) as client:
        for page in range(MAX_PAGES):
            payload = {
                "limit": PAGE_SIZE,
                "offset": page * PAGE_SIZE,
                "searchText": "",
                "appliedFacets": {}
            }
            try:
                r = await client.post(ep["api"], json=payload, headers=headers, timeout=15.0)
                r.raise_for_status()
                data = r.json()
            except Exception:
                break
                
            postings = data.get("jobPostings", [])
            if not isinstance(postings, list):
                break
                
            for j in postings:
                if not j.get("externalPath"):
                    continue
                jobs.append({
                    "title": j.get("title", ""),
                    "url": ep["jobBase"] + j["externalPath"],
                    "company": company_name,
                    "location": j.get("locationsText", ""),
                    "description": "",
                    "posted_at": parse_posted_on(j.get("postedOn"))
                })
                
            if len(postings) < PAGE_SIZE:
                break
                
    return jobs
