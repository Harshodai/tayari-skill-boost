"""Job listing providers - free, key-less public APIs, normalized to one schema.
Pluggable adapter pattern: add JSearch/Adzuna/LinkedIn adapters later by
implementing fetch(query, location) -> list[dict] and registering in PROVIDERS.
"""
import asyncio
import hashlib
import logging
import re
import uuid

import httpx

logger = logging.getLogger(__name__)

UA = {"User-Agent": "Mozilla/5.0 (Tayari/1.0; +https://tayari.app)"}


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"&[a-z]+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _norm(source, title, company, location, url, description, tags=None,
          salary=None, posted_at=None, remote=True):
    return {
        "job_id": str(uuid.uuid4()),
        "source": source,
        "title": (title or "").strip(),
        "company": (company or "").strip() or "Unknown",
        "location": (location or "Remote").strip() or "Remote",
        "remote": bool(remote),
        "url": url or "",
        "description": _strip_html(description)[:1500],
        "tags": [t for t in (tags or []) if t][:12],
        "salary": salary or "",
        "posted_at": posted_at or "",
    }


async def fetch_remotive(client: httpx.AsyncClient, query: str) -> list:
    try:
        resp = await client.get(
            "https://remotive.com/api/remote-jobs",
            params={"search": query, "limit": 25}, headers=UA)
        resp.raise_for_status()
        jobs = resp.json().get("jobs", [])
        return [
            _norm("remotive", j.get("title"), j.get("company_name"),
                  j.get("candidate_required_location"), j.get("url"),
                  j.get("description"), j.get("tags"), j.get("salary"),
                  j.get("publication_date"))
            for j in jobs
        ]
    except Exception as exc:
        logger.warning("Remotive fetch failed: %s", exc)
        return []


async def fetch_arbeitnow(client: httpx.AsyncClient, query: str) -> list:
    try:
        resp = await client.get("https://www.arbeitnow.com/api/job-board-api", headers=UA)
        resp.raise_for_status()
        jobs = resp.json().get("data", [])
        q = query.lower()
        results = []
        for j in jobs:
            haystack = " ".join([
                j.get("title", ""), " ".join(j.get("tags", [])),
                " ".join(j.get("job_types", [])), j.get("description", "")[:600],
            ]).lower()
            if q and not all(part in haystack for part in q.split()[:3]):
                continue
            results.append(_norm(
                "arbeitnow", j.get("title"), j.get("company_name"), j.get("location"),
                j.get("url"), j.get("description"), j.get("tags"),
                None,
                None,
                j.get("remote", False)))
        return results[:25]
    except Exception as exc:
        logger.warning("Arbeitnow fetch failed: %s", exc)
        return []


async def fetch_remoteok(client: httpx.AsyncClient, query: str) -> list:
    try:
        resp = await client.get("https://remoteok.com/api", headers=UA)
        resp.raise_for_status()
        data = resp.json()
        q = query.lower()
        results = []
        for j in data:
            if not isinstance(j, dict) or not j.get("position"):
                continue  # first element is a legal notice
            haystack = " ".join([
                j.get("position", ""), " ".join(j.get("tags", []) or []),
                (j.get("description") or "")[:600],
            ]).lower()
            if q and not all(part in haystack for part in q.split()[:3]):
                continue
            salary = ""
            if j.get("salary_min") and j.get("salary_max"):
                salary = f"${int(j['salary_min']):,} - ${int(j['salary_max']):,}"
            results.append(_norm(
                "remoteok", j.get("position"), j.get("company"),
                j.get("location") or "Remote", j.get("url"), j.get("description"),
                j.get("tags"), salary, j.get("date")))
        return results[:25]
    except Exception as exc:
        logger.warning("RemoteOK fetch failed: %s", exc)
        return []


PROVIDERS = [fetch_remotive, fetch_arbeitnow, fetch_remoteok]

# --- Hermes provider shims (WS-F) -------------------------------------------
# Tiered scraping layer: each Hermes provider self-disables when its key is
# absent (env-gated). The 3 free providers above stay FIRST so the pipeline
# always returns results with zero keys; Hermes providers are appended only
# when their ``.available()`` is True. Import is guarded so a missing optional
# dependency never breaks the module.
_hermes_active: list[str] = []
try:
    from app.services.hermes.providers import (  # noqa: E402
        ALL_PROVIDERS as _HERMES_ALL_PROVIDERS,
    )

    for _provider in _HERMES_ALL_PROVIDERS:
        try:
            if _provider.available():
                PROVIDERS.append(_provider.fetch)
                _hermes_active.append(_provider.name)
        except Exception as _exc:  # noqa: BLE001 - one bad provider must not break others
            logger.warning("Hermes provider %s unavailable: %s", getattr(_provider, "name", "?"), _exc)
    logger.info("Hermes providers active: %s", ", ".join(_hermes_active) or "(none)")
except Exception as _exc:  # noqa: BLE001 - hermes package is optional
    logger.warning("Hermes provider layer disabled: %s", _exc)
del _hermes_active


def _dedupe(jobs: list) -> list:
    seen = set()
    out = []
    for j in jobs:
        key = (j["title"].lower(), j["company"].lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(j)
    return out


async def search_jobs(query: str, location: str = "", limit: int = 40) -> list:
    """Aggregate all providers in parallel."""
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        batches = await asyncio.gather(*[p(client, query) for p in PROVIDERS])
    jobs = _dedupe([j for batch in batches for j in batch])

    if location:
        loc = location.lower()
        scored = sorted(jobs, key=lambda j: 0 if loc in j["location"].lower() else 1)
        jobs = scored

    return jobs[:limit]
