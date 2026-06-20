"""Hermes - tiered server-side job scraping orchestrator.

Hybrid stack, env-gated: free ATS JSON APIs first (Greenhouse/Lever/Ashby/
Workday), then key-requiring tiers (SerpApi/Firecrawl/Apify) and an in-process
Crawl4AI fallback. Each provider is wrapped in its own ``CircuitBreaker`` and
normalizes results through ``job_providers._norm`` so downstream code needs no
changes.
"""
from __future__ import annotations

from app.services.hermes.config import AVAILABLE_PROVIDERS
from app.services.hermes.orchestrator import HermesScraper
from app.services.hermes.providers import (
    ALL_PROVIDERS,
    ashby,
    apify,
    crawl4ai,
    firecrawl,
    greenhouse,
    lever,
    serp,
    workday,
)

# Singletons available for direct import by WS-F wiring.
AVAILABLE_PROVIDERS  # noqa: F401 - re-exported for tests/wiring

__all__ = [
    "HermesScraper",
    "AVAILABLE_PROVIDERS",
    "ALL_PROVIDERS",
    "greenhouse",
    "lever",
    "ashby",
    "workday",
    "firecrawl",
    "apify",
    "serp",
    "crawl4ai",
]