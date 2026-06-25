import re
from urllib.parse import urlparse
import httpx

ALLOWED_GREENHOUSE_HOSTS = {
    'boards-api.greenhouse.io',
    'boards.greenhouse.io',
    'job-boards.greenhouse.io',
    'job-boards.eu.greenhouse.io',
}

def resolve_api_url(careers_url: str, api_url: str = None) -> str | None:
    if api_url:
        return api_url
    match = re.search(r'job-boards(?:\.eu)?\.greenhouse\.io/([^/?#]+)', careers_url)
    if match:
        return f"https://boards-api.greenhouse.io/v1/boards/{match.group(1)}/jobs"
    return None

async def fetch_jobs(company_name: str, careers_url: str, api_url: str = None) -> list[dict]:
    url = resolve_api_url(careers_url, api_url)
    if not url:
        return []
    
    parsed = urlparse(url)
    if parsed.hostname not in ALLOWED_GREENHOUSE_HOSTS:
        return []
        
    async with httpx.AsyncClient(follow_redirects=False) as client:
        r = await client.get(url, timeout=15.0)
        r.raise_for_status()
        data = r.json()
        
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    results = []
    for j in jobs:
        if not j.get("absolute_url"):
            continue
        results.append({
            "title": j.get("title", ""),
            "url": j.get("absolute_url"),
            "company": company_name,
            "location": (j.get("location") or {}).get("name", ""),
            "description": "",
            "posted_at": j.get("first_published")
        })
    return results
