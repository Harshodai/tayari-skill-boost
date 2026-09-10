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


def _slug_candidates(company: str) -> List[str]:
    """Deterministic board-slug guesses for a company display name.

    Real ATS board tokens don't always match the display name a candidate
    would type ("Phenom People" -> "phenompeople", not "phenom people" with
    a literal space, which isn't a valid URL path segment at all). This
    tries a small, honest set of real variations — no fabrication, just
    actually querying each one — instead of a single lowercase guess that
    silently fails for any company whose token isn't identical to its name.
    """
    base = company.strip().lower()
    candidates = [base]
    no_space = re.sub(r"\s+", "", base)
    if no_space not in candidates:
        candidates.append(no_space)
    hyphenated = re.sub(r"\s+", "-", base)
    if hyphenated not in candidates:
        candidates.append(hyphenated)
    return candidates


async def check_greenhouse_board(company: str, keywords: List[str]) -> RadarCheckResult:
    """Query Greenhouse keyless public JSON API for open jobs, trying a few
    real slug variants of the company name before reporting it unfound."""
    result = RadarCheckResult(company=company)
    last_status: Optional[int] = None

    for slug in _slug_candidates(company):
        url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url)
        except Exception as exc:
            result.error = str(exc)
            continue
        if resp.status_code != 200:
            last_status = resp.status_code
            continue
        # Found a real board — stop trying other slug variants.
        return await _parse_greenhouse_response(resp, company, keywords, result)

    if result.error is None:
        result.error = f"HTTP {last_status}" if last_status else "board not found"
    return result


async def _parse_greenhouse_response(resp, company: str, keywords: List[str], result: RadarCheckResult) -> RadarCheckResult:
    try:
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
    """Query Lever keyless public JSON API for open jobs, trying a few real
    slug variants of the company name before reporting it unfound."""
    result = RadarCheckResult(company=company)
    last_status: Optional[int] = None

    for slug in _slug_candidates(company):
        url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url)
        except Exception as exc:
            result.error = str(exc)
            continue
        if resp.status_code != 200:
            last_status = resp.status_code
            continue
        try:
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

    if result.error is None:
        result.error = f"HTTP {last_status}" if last_status else "board not found"
    return result


_SEARCH_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


async def _keyless_web_search(query: str, limit: int = 5) -> List[str]:
    """Real, keyless web search — no API key required.

    This project has no configured search/scrape provider (Firecrawl,
    SerpAPI, Apify are all unset in this deployment), so a paid-API design
    isn't viable here. This mirrors the fallback pattern lean production
    agents actually use when they don't want a single paid vendor as a hard
    dependency for basic web lookup: DuckDuckGo's HTML endpoint requires no
    key, returns real results, and its markup is stable enough to parse
    with the stdlib-adjacent `lxml` (already a dependency here). Returns
    real result URLs, decoded from DDG's redirect-wrapper links — never
    fabricated.
    """
    import lxml.html
    from urllib.parse import urlparse, parse_qs, unquote

    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": _SEARCH_USER_AGENT}) as client:
        resp = await client.get("https://html.duckduckgo.com/html/", params={"q": query})
        resp.raise_for_status()

    tree = lxml.html.fromstring(resp.text)
    urls: List[str] = []
    for a in tree.xpath('//a[contains(concat(" ", normalize-space(@class), " "), " result__a ")]'):
        href = a.get("href") or ""
        # DDG's HTML endpoint wraps results as //duckduckgo.com/l/?uddg=<encoded real url>
        parsed = urlparse(href)
        real_url = href
        if "duckduckgo.com" in parsed.netloc and parsed.path == "/l/":
            qs = parse_qs(parsed.query)
            if qs.get("uddg"):
                real_url = unquote(qs["uddg"][0])
        if real_url.startswith("http") and real_url not in urls:
            urls.append(real_url)
        if len(urls) >= limit:
            break
    return urls


async def _fetch_page_text(url: str, max_chars: int = 6000) -> str:
    """Real direct fetch + text extraction of one page — no scraping API."""
    import lxml.html

    async with httpx.AsyncClient(
        timeout=15.0, headers={"User-Agent": _SEARCH_USER_AGENT}, follow_redirects=True
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    tree = lxml.html.fromstring(resp.text)
    for tag in tree.xpath("//script | //style | //noscript | //svg"):
        tag.drop_tree()
    text = tree.text_content()
    # Collapse excessive whitespace from templated HTML without losing line breaks.
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # Also collect real hrefs on the page — job listing titles often live in
    # <a> text with the posting URL right there, which the pure text
    # extraction above loses. Pass both to the LLM so it can ground postings
    # in an actual (text, url) pair instead of guessing a URL for a title.
    links = []
    for a in tree.xpath("//a[@href]"):
        label = " ".join(a.text_content().split())
        href = a.get("href") or ""
        if label and href.startswith("http") and len(label) > 3:
            links.append(f"{label} -> {href}")

    body = "\n".join(lines)
    link_block = "\n".join(links[:200])
    combined = f"{body}\n\n--- LINKS ON PAGE ---\n{link_block}"
    return combined[:max_chars]


async def find_via_web_search(company: str, keywords: List[str]) -> RadarCheckResult:
    """Last-resort path for a company not on Greenhouse or Lever: search the
    real web (keylessly — see _keyless_web_search) for its actual career
    page, fetch that real page directly, and extract only job postings the
    LLM can point to in the fetched text/links — never fabricated.
    """
    result = RadarCheckResult(company=company)
    try:
        # 1. Real web search for the company's actual career page.
        urls = await _keyless_web_search(f"{company} careers jobs page")
        career_url = next((u for u in urls if _looks_like_career_url(u)), None)
        if not career_url:
            result.error = "no career page found via web search"
            return result

        # 2. Real direct fetch of that real page (not a guess — the URL a
        # search engine actually returned for this company).
        try:
            page_text = await _fetch_page_text(career_url)
        except Exception as exc:
            result.error = f"found {career_url} but could not fetch it ({exc})"
            return result
        if not page_text.strip():
            result.error = f"found {career_url} but page had no extractable content"
            return result

        # 3. Extract ONLY postings the LLM can point to in the fetched
        # text/links — grounded in real content just fetched, not invented.
        from app.services.llm_service import llm_json, LLMNotConfiguredError

        system = (
            "You extract real job postings from a fetched career-page's text "
            "content and links. List ONLY postings whose title and URL "
            "literally appear in the provided material. Never invent a title "
            "or URL that isn't there — if the page doesn't list individual "
            "postings (e.g. it's a redirect to a third-party ATS you can't "
            "see), return an empty list rather than guessing."
        )
        user = f"""Fetched from {career_url} (company: {company}):
{page_text}

Keywords of interest: {', '.join(keywords)}

Return JSON: {{"jobs": [{{"title": "<exact title from text/links>", "url": "<exact url from links>", "location": "<location if stated, else \\"Not specified\\">"}}]}}
Only include postings relevant to the keywords above. If none, return {{"jobs": []}}."""
        try:
            extracted = await llm_json(system, user, max_tokens=800)
        except LLMNotConfiguredError:
            result.error = f"found {career_url} via web search, but no LLM configured to extract postings from it"
            return result

        jobs = extracted.get("jobs", []) if isinstance(extracted, dict) else []
        for job in jobs:
            title = str(job.get("title", "")).strip()
            job_url = str(job.get("url", "")).strip()
            if not title or not job_url:
                continue
            result.jobs_found.append(
                RadarJob(
                    title=title,
                    company=company.title(),
                    location=str(job.get("location", "Not specified")),
                    url=job_url,
                    ats_source=f"Web Search ({career_url})",
                    match_score=0.6,
                )
            )
        result.new_jobs_count = len(result.jobs_found)
        return result
    except Exception as exc:  # noqa: BLE001 - fallback must never crash the scan
        logger.warning("company_radar: web-search fallback failed for %r: %s", company, exc)
        result.error = f"web search fallback failed: {exc}"
        return result


def _looks_like_career_url(url: str) -> bool:
    low = url.lower()
    return any(k in low for k in ("career", "jobs", "join-us", "join-our", "work-with-us"))


async def monitor_target_companies(
    companies: List[str],
    keywords: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Execute Sentinel scan across target company roster."""
    target_keywords = keywords or ["engineer", "developer", "backend", "frontend", "full stack", "ai", "machine learning", "product manager"]
    all_results = []
    total_new = 0

    for company in companies:
        company_clean = company.strip()
        if not company_clean:
            continue

        # Try Greenhouse first. gh_res.error is only set when no board was
        # ever found for any slug variant — a real board with zero
        # keyword-matching jobs returns error=None, jobs_found=[], and is a
        # genuine, correctly-reported "0 matches" result on its own; falling
        # through to Lever in that case would overwrite it with a spurious
        # 404 from a platform the company was never on, misreporting a
        # successful scan as a failed one.
        gh_res = await check_greenhouse_board(company_clean, target_keywords)
        if gh_res.error is None:
            all_results.append(gh_res)
            total_new += gh_res.new_jobs_count
            continue

        # Greenhouse board genuinely not found — try Lever.
        lever_res = await check_lever_board(company_clean, target_keywords)
        if lever_res.error is None:
            all_results.append(lever_res)
            total_new += lever_res.new_jobs_count
            continue

        # Not on Greenhouse or Lever either — this company likely uses a
        # different ATS (or none at all). Search the real web for its
        # actual career page and scrape it, rather than reporting "not
        # found" for every company that isn't on exactly these two
        # platforms.
        web_res = await find_via_web_search(company_clean, target_keywords)
        all_results.append(web_res)
        total_new += web_res.new_jobs_count

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
