"""WS-F integration tests for job_agent.smart_search + Hermes scrape wiring.

Covers:
- scrape_enrich=True merges Hermes-scraped jobs with free-provider results and
  the agent_trace mentions hermes.
- scrape_enrich=False skips the Hermes scrape entirely.
- target_board is passed through to HermesScraper.scrape.
- A Hermes scrape failure degrades gracefully to free-provider results.

Mocks job_providers.search_jobs and the hermes scrape helper so no network is
hit and no optional deps are required.

Run:  python -m pytest tests/test_job_agent_hermes.py -v
"""
from __future__ import annotations

import asyncio

import pytest

import app.services.job_agent as job_agent
from app.services.job_agent import smart_search


# ---------------------------------------------------------------------------
# Shared job fixtures
# ---------------------------------------------------------------------------

FREE_JOB_A = {
    "job_id": "a1",
    "source": "remotive",
    "title": "Backend Engineer",
    "company": "Acme",
    "location": "Remote",
    "remote": True,
    "url": "https://remotive.com/a1",
    "description": "Build APIs",
    "tags": ["python"],
    "salary": "",
    "posted_at": "",
}

FREE_JOB_B = {
    "job_id": "b2",
    "source": "arbeitnow",
    "title": "Frontend Engineer",
    "company": "Globex",
    "location": "Berlin",
    "remote": False,
    "url": "https://arbeitnow.com/b2",
    "description": "Build UI",
    "tags": ["react"],
    "salary": "",
    "posted_at": "",
}

HERMES_JOB = {
    "job_id": "h1",
    "source": "greenhouse",
    "title": "Senior Software Engineer",
    "company": "airbnb",
    "location": "San Francisco, CA",
    "remote": False,
    "url": "https://boards.greenhouse.io/airbnb/jobs/h1",
    "description": "Greenhouse-scraped JD",
    "tags": ["distributed"],
    "salary": "",
    "posted_at": "",
}

# A Hermes job that duplicates a free-provider job by title+company, proving
# the existing dedupe still applies across the two sources.
HERMES_DUP = {
    "job_id": "h2",
    "source": "greenhouse",
    "title": "Backend Engineer",   # same as FREE_JOB_A
    "company": "Acme",            # same as FREE_JOB_A
    "location": "Remote",
    "remote": True,
    "url": "https://boards.greenhouse.io/acme/jobs/h2",
    "description": "dup",
    "tags": [],
    "salary": "",
    "posted_at": "",
}


@pytest.fixture
def stub_free_search(monkeypatch):
    """Replace search_jobs so smart_search never hits the network."""
    async def _fake_search_jobs(query, location="", limit=40):
        return [dict(FREE_JOB_A), dict(FREE_JOB_B)]
    monkeypatch.setattr(job_agent, "search_jobs", _fake_search_jobs)
    return _fake_search_jobs


@pytest.fixture
def stub_hermes_scrape(monkeypatch):
    """Replace _hermes_scrape with a recorder that returns HERMES_JOB set."""
    calls: list[dict] = []

    async def _fake_scrape(query, location, target_board):
        calls.append({
            "query": query,
            "location": location,
            "target_board": target_board,
        })
        return [dict(HERMES_JOB), dict(HERMES_DUP)]

    monkeypatch.setattr(job_agent, "_hermes_scrape", _fake_scrape)
    return calls


@pytest.fixture(autouse=True)
def stub_llm_rank(monkeypatch):
    """Rank/prerank/query-derivation must not call the real LLM."""
    async def _fake_rank(candidate, jobs, top_n=12):
        out = []
        for j in jobs:
            scored = dict(j)
            scored.setdefault("match_score", 80)
            scored.setdefault("matched_skills", [])
            scored.setdefault("missing_skills", [])
            scored.setdefault("match_reason", "stub")
            out.append(scored)
        return out[:top_n]
    monkeypatch.setattr(job_agent, "rank_jobs", _fake_rank)
    # hybrid_prerank uses embeddings + taxonomy; keep it cheap by stubbing it.
    async def _fake_prerank(jobs, profile, resume_text):
        return list(jobs), "stub"
    monkeypatch.setattr(job_agent, "hybrid_prerank", _fake_prerank)
    # derive_query should not call the LLM either.
    monkeypatch.setattr(job_agent, "active_engine", lambda: "stub-engine")


# ---------------------------------------------------------------------------
# Tests (sync wrappers around asyncio.run — no pytest-asyncio dependency)
# ---------------------------------------------------------------------------

def test_scrape_enrich_merges_hermes_jobs(stub_free_search, stub_hermes_scrape):
    result = asyncio.run(smart_search(
        "software engineer", "Remote", None, None, top_n=12,
        scrape_enrich=True, target_board={"class": "greenhouse", "token": "airbnb"},
    ))

    titles_companies = {(j["title"], j["company"]) for j in result["results"]}
    assert ("Backend Engineer", "Acme") in titles_companies
    assert ("Frontend Engineer", "Globex") in titles_companies
    assert ("Senior Software Engineer", "airbnb") in titles_companies

    # The Hermes duplicate of the free-provider job must NOT appear twice.
    dup_count = sum(1 for j in result["results"]
                    if j["title"] == "Backend Engineer" and j["company"] == "Acme")
    assert dup_count == 1

    # Hermes scrape was called with the target board.
    assert len(stub_hermes_scrape) == 1
    assert stub_hermes_scrape[0]["target_board"] == {"class": "greenhouse", "token": "airbnb"}

    # Trace mentions hermes.
    trace_blob = " ".join(e["detail"] for e in result["agent_trace"])
    assert "Hermes" in trace_blob


def test_scrape_enrich_false_skips_hermes(stub_free_search, stub_hermes_scrape):
    result = asyncio.run(smart_search(
        "software engineer", "Remote", None, None, top_n=12,
        scrape_enrich=False, target_board={"class": "greenhouse", "token": "airbnb"},
    ))

    titles_companies = {(j["title"], j["company"]) for j in result["results"]}
    assert ("Senior Software Engineer", "airbnb") not in titles_companies
    assert ("Backend Engineer", "Acme") in titles_companies

    # Hermes scrape was NOT called.
    assert stub_hermes_scrape == []


def test_target_board_none_by_default(stub_free_search, stub_hermes_scrape):
    asyncio.run(smart_search("software engineer", "Remote", None, None, top_n=12))
    assert len(stub_hermes_scrape) == 1
    assert stub_hermes_scrape[0]["target_board"] is None


def test_hermes_scrape_failure_degrades_to_free_providers(stub_free_search, monkeypatch):
    """A scraping exception must not break the search pipeline.

    The real ``_hermes_scrape`` helper wraps HermesScraper.scrape in a
    try/except that returns ``[]`` on any failure. We stub the scraper's
    ``scrape`` method to raise and confirm smart_search still returns the
    free-provider jobs (the helper's internal guard swallows the error).
    """
    from app.services.hermes.orchestrator import HermesScraper

    async def _failing_scrape(self, query, location="", board=None, limit=40):
        raise RuntimeError("hermes down")
    monkeypatch.setattr(HermesScraper, "scrape", _failing_scrape)

    result = asyncio.run(smart_search(
        "software engineer", "Remote", None, None, top_n=12,
        scrape_enrich=True, target_board=None,
    ))
    titles_companies = {(j["title"], j["company"]) for j in result["results"]}
    assert ("Backend Engineer", "Acme") in titles_companies
    assert ("Frontend Engineer", "Globex") in titles_companies
    assert ("Senior Software Engineer", "airbnb") not in titles_companies