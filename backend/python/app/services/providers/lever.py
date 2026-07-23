from __future__ import annotations
import re
import httpx

def resolve_api_url(careers_url: str) -> str | None:
    match = re.search(r'jobs\.lever\.co/([^/?#]+)', careers_url)
    if not match:
        return None
    return f"https://api.lever.co/v0/postings/{match.group(1)}"

async def fetch_jobs(company_name: str, careers_url: str) -> list[dict]:
    url = resolve_api_url(careers_url)
    if not url:
        return []
        
    async with httpx.AsyncClient(follow_redirects=False) as client:
        r = await client.get(url, timeout=15.0)
        r.raise_for_status()
        data = r.json()
        
    if not isinstance(data, list):
        return []
        
    results = []
    for j in data:
        results.append({
            "title": j.get("text", ""),
            "url": j.get("hostedUrl", ""),
            "company": company_name,
            "location": (j.get("categories") or {}).get("location", ""),
            "description": j.get("descriptionPlain", "") or "",
            "posted_at": j.get("createdAt")
        })
    return results
