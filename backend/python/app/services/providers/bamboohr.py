import re
from urllib.parse import urlparse, quote
import httpx

BAMBOOHR_HOST_RE = re.compile(r'^[a-z0-9][a-z0-9-]*\.bamboohr\.com$')

def resolve_origin(careers_url: str, api_url: str = None) -> str | None:
    raw = (api_url or careers_url).strip()
    if not raw:
        return None
    try:
        parsed = urlparse(raw)
        if parsed.scheme != "https":
            return None
        if not BAMBOOHR_HOST_RE.match(parsed.hostname):
            return None
        return f"https://{parsed.hostname}"
    except Exception:
        return None

async def fetch_jobs(company_name: str, careers_url: str, api_url: str = None) -> list[dict]:
    origin = resolve_origin(careers_url, api_url)
    if not origin:
        return []
        
    target_api = f"{origin}/careers/list"
    async with httpx.AsyncClient(follow_redirects=False) as client:
        r = await client.get(target_api, timeout=15.0)
        r.raise_for_status()
        data = r.json()
        
    results = data.get("result") if isinstance(data, dict) else []
    if not isinstance(results, list):
        return []
        
    jobs = []
    for j in results:
        if not j or not j.get("jobOpeningName") or not str(j.get("id", "")).strip():
            continue
        loc = j.get("location") or {}
        city = loc.get("city") or ""
        state = loc.get("state") or ""
        remote = "Remote" if j.get("isRemote") else ""
        location = ", ".join(filter(None, [city, state, remote]))
        job_id = str(j["id"]).strip()
        jobs.append({
            "title": str(j["jobOpeningName"]),
            "url": f"{origin}/careers/{quote(job_id)}",
            "company": company_name,
            "location": location,
            "description": "",
            "posted_at": None
        })
    return jobs
