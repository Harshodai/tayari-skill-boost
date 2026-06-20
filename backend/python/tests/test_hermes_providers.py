"""Hermes provider + orchestrator tests.

Network-dependent tests are marked ``@pytest.mark.network`` and skipped by
default so CI without provider keys still passes. Unit tests mock httpx via
``httpx.MockTransport`` (no extra deps required).

Run:  python -m pytest tests/test_hermes_providers.py -v
      python -m pytest tests/test_hermes_providers.py -v -m network   (needs keys)
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import httpx
import pytest

from app.services.hermes import HermesScraper
from app.services.hermes.normalize import _classify_board
from app.services.hermes.orchestrator import _default_breaker
from app.services.hermes.providers import (
    ALL_PROVIDERS,
    ashby,
    greenhouse,
    lever,
)
from app.services.hermes.providers.apify import ApifyProvider
from app.services.hermes.providers.firecrawl import FirecrawlProvider
from app.services.hermes.providers.serp_google_jobs import SerpProvider
from app.services.hermes.router import select_tier


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _client_with_handler(handler: Any) -> httpx.AsyncClient:
    """Build an AsyncClient whose requests are answered by ``handler``."""
    transport = httpx.MockTransport(handler)
    return httpx.AsyncClient(transport=transport, timeout=10)


@pytest.fixture
def clean_env(monkeypatch):
    """Strip provider keys so gated providers are unavailable."""
    for key in ("FIRECRAWL_API_KEY", "APIFY_API_TOKEN", "SERPAPI_API_KEY",
                "DATABASE_URL"):
        monkeypatch.delenv(key, raising=False)


# ---------------------------------------------------------------------------
# Board classification
# ---------------------------------------------------------------------------

def test_classify_greenhouse():
    result = _classify_board("https://boards-api.greenhouse.io/v1/boards/airbnb/jobs")
    assert result == {"class": "greenhouse", "token": "airbnb"}


def test_classify_lever():
    result = _classify_board("https://jobs.lever.co/stripe")
    assert result == {"class": "lever", "token": "stripe"}


def test_classify_ashby():
    result = _classify_board("https://jobs.ashbyhq.com/notion")
    assert result == {"class": "ashby", "token": "notion"}


def test_classify_workday():
    result = _classify_board("https://acme.wd1.myworkdayjobs.com/en-US")
    assert result == {"class": "workday", "token": "acme.wd1.myworkdayjobs.com"}


def test_classify_unknown():
    assert _classify_board("https://example.com") is None
    assert _classify_board(None) is None


# ---------------------------------------------------------------------------
# ATS providers normalize correctly (mocked JSON)
# ---------------------------------------------------------------------------

GREENHOUSE_PAYLOAD = {
    "jobs": [
        {
            "id": 123,
            "title": "Senior Software Engineer",
            "location": {"name": "San Francisco, CA"},
            "absolute_url": "https://boards.greenhouse.io/airbnb/jobs/123",
            "content": "<p>Build things <b>fast</b></p>",
            "departments": [{"name": "Engineering"}, {"name": "Core"}],
        }
    ]
}


def test_greenhouse_normalizes():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "boards-api.greenhouse.io" in str(request.url)
        return httpx.Response(200, json=GREENHOUSE_PAYLOAD)

    async def run() -> list:
        client = _client_with_handler(handler)
        try:
            return await greenhouse.fetch(
                client, "software engineer", board={"token": "airbnb"},
            )
        finally:
            await client.aclose()

    jobs = asyncio.run(run())
    assert len(jobs) == 1
    job = jobs[0]
    assert job["source"] == "greenhouse"
    assert job["title"] == "Senior Software Engineer"
    assert job["company"] == "airbnb"
    assert job["location"] == "San Francisco, CA"
    assert job["url"] == "https://boards.greenhouse.io/airbnb/jobs/123"
    assert "Engineering" in job["tags"]
    # HTML stripped from description
    assert "<" not in job["description"]
    assert "Build things" in job["description"]


LEVER_PAYLOAD = [
    {
        "text": "Backend Engineer",
        "categories": {"location": "Remote", "team": "Platform", "commitment": "Full-time"},
        "hostedUrl": "https://jobs.lever.co/stripe/abc",
        "lists": [{"content": "<p>Own services</p>"}, {"content": "<p>On-call</p>"}],
    }
]


def test_lever_normalizes():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=LEVER_PAYLOAD)

    async def run() -> list:
        client = _client_with_handler(handler)
        try:
            return await lever.fetch(client, "engineer", board={"token": "stripe"})
        finally:
            await client.aclose()

    jobs = asyncio.run(run())
    assert len(jobs) == 1
    job = jobs[0]
    assert job["source"] == "lever"
    assert job["title"] == "Backend Engineer"
    assert job["company"] == "stripe"
    assert job["location"] == "Remote"
    assert "Platform" in job["tags"]
    assert "Own services" in job["description"]
    assert "On-call" in job["description"]


ASHBY_PAYLOAD = {
    "postedJobs": [
        {
            "title": "ML Engineer",
            "locationText": "New York, NY",
            "externalUrl": "https://ashbyhq.com/notion/jobs/1",
            "descriptionHtml": "<p>Scale ML</p>",
            "compensation": {
                "compensationTierSummary": [{"min": "$150k", "max": "$200k"}],
            },
        }
    ]
}


def test_ashby_normalizes():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=ASHBY_PAYLOAD)

    async def run() -> list:
        client = _client_with_handler(handler)
        try:
            return await ashby.fetch(client, "ml", board={"token": "notion"})
        finally:
            await client.aclose()

    jobs = asyncio.run(run())
    assert len(jobs) == 1
    job = jobs[0]
    assert job["source"] == "ashby"
    assert job["title"] == "ML Engineer"
    assert job["company"] == "notion"
    assert job["location"] == "New York, NY"
    assert "Scale ML" in job["description"]


def test_greenhouse_http_error_returns_empty():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    async def run() -> list:
        client = _client_with_handler(handler)
        try:
            return await greenhouse.fetch(client, "x", board={"token": "airbnb"})
        finally:
            await client.aclose()

    assert asyncio.run(run()) == []


# ---------------------------------------------------------------------------
# Orchestrator graceful degradation
# ---------------------------------------------------------------------------

def test_scrape_returns_empty_when_all_providers_fail(clean_env):
    """All providers error/empty -> scrape returns [] without raising.

    Providers hit the mock 500 transport, catch the error internally, and
    return [] (they never raise out of scrape_one).
    """
    scraper = HermesScraper(providers=[greenhouse, lever, ashby])

    async def run() -> list:
        async with httpx.AsyncClient(transport=httpx.MockTransport(_500_handler)) as client:
            batches = await asyncio.gather(*[
                scraper.scrape_one(p, client, "engineer", "", None)
                for p in [greenhouse, lever, ashby]
            ])
            return [j for b in batches for j in b]

    assert asyncio.run(run()) == []


def test_scrape_with_no_keys_returns_list_or_empty(clean_env):
    """Keyless config: scrape should run ATS providers and not raise."""
    scraper = HermesScraper(providers=[greenhouse, lever, ashby, workday_only()])

    # Make ATS providers return [] (no network) via monkeypatching fetch.
    scraper.providers = [greenhouse, lever, ashby]
    for p in scraper.providers:
        scraper._wrapped[p.name] = breaker_wrap(scraper, _empty_fetch)

    async def run() -> list:
        return await scraper.scrape("engineer", "Remote")

    result = asyncio.run(run())
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Circuit breaker
# ---------------------------------------------------------------------------

def test_circuit_breaker_skips_failing_provider(monkeypatch):
    """After FAILURE_THRESHOLD failures the breaker opens and the provider
    is skipped (returns []) instead of being called again."""
    call_count = {"n": 0}

    class FlakyProvider:
        name = "flaky"
        tier = "ats"
        requires_key = False
        board_class = None

        def available(self) -> bool:
            return True

        async def fetch(self, client, query, location="", board=None):
            call_count["n"] += 1
            raise RuntimeError("provider down")

    provider = FlakyProvider()
    scraper = HermesScraper(providers=[provider])

    async def run() -> list:
        async with httpx.AsyncClient(transport=httpx.MockTransport(_500_handler)) as client:
            for _ in range(6):  # exceed FAILURE_THRESHOLD (5)
                await scraper.scrape_one(provider, client, "x", "", None)
            # breaker should now be OPEN -> still returns [] without calling fetch
            before = call_count["n"]
            result = await scraper.scrape_one(provider, client, "x", "", None)
            return [before, result, call_count["n"]]

    before, result, after = asyncio.run(run())
    assert result == []
    assert call_count["n"] == before  # fetch not called while open
    assert before >= 5  # opened after threshold


# ---------------------------------------------------------------------------
# Availability gating
# ---------------------------------------------------------------------------

def test_keyed_providers_unavailable_without_keys(clean_env):
    firecrawl_p = FirecrawlProvider()
    apify_p = ApifyProvider()
    serp_p = SerpProvider()
    assert firecrawl_p.available() is False
    assert apify_p.available() is False
    assert serp_p.available() is False


def test_ats_providers_always_available(clean_env):
    assert greenhouse.available() is True
    assert lever.available() is True
    assert ashby.available() is True


def test_firecrawl_available_with_key(monkeypatch):
    """Setting the key makes firecrawl_available() True; clearing restores False."""
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc-test-key")
    import importlib
    from app.services.hermes import config as hermes_config
    importlib.reload(hermes_config)
    try:
        assert hermes_config.firecrawl_available() is True
    finally:
        monkeypatch.delenv("FIRECRAWL_API_KEY", raising=False)
        importlib.reload(hermes_config)
    assert hermes_config.firecrawl_available() is False


def test_router_filters_to_available(clean_env):
    selected = select_tier(None, ALL_PROVIDERS)
    # All selected must be available.
    assert all(p.available() for p in selected)
    # ATS providers present, keyed providers absent.
    names = {p.name for p in selected}
    assert {"greenhouse", "lever", "ashby", "workday"} <= names
    assert "serp" not in names
    assert "firecrawl" not in names
    assert "apify" not in names


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _empty_fetch(client, query, location="", board=None):
    return []


def _500_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(500, text="server error")


def workday_only():
    from app.services.hermes.providers import workday as wd
    return wd


def breaker_wrap(scraper: HermesScraper, fetch) -> Any:
    """Wrap ``fetch`` with a fresh breaker for test providers."""
    from app.services.circuit_breaker import CircuitBreaker
    breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60, name="test")
    return breaker(fetch)


# ---------------------------------------------------------------------------
# Network-gated tests (skipped by default)
# ---------------------------------------------------------------------------

@pytest.mark.network
def test_greenhouse_live_default_tokens():
    async def run() -> list:
        async with httpx.AsyncClient(timeout=20) as client:
            return await greenhouse.fetch(client, "engineer")
    jobs = asyncio.run(run())
    assert isinstance(jobs, list)


@pytest.mark.network
def test_scrape_live_keyless():
    scraper = HermesScraper()
    jobs = asyncio.run(scraper.scrape("software engineer", "Remote"))
    assert isinstance(jobs, list)