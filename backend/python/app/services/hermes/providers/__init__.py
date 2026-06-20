"""Hermes provider singletons + ALL_PROVIDERS registry.

Each provider module exposes a module-level singleton implementing the
``ScrapingProvider`` protocol. Importing this package wires the full set.
"""
from __future__ import annotations

from app.services.hermes.providers.ats_greenhouse import greenhouse
from app.services.hermes.providers.ats_lever import lever
from app.services.hermes.providers.ats_ashby import ashby
from app.services.hermes.providers.ats_workday import workday
from app.services.hermes.providers.firecrawl import firecrawl
from app.services.hermes.providers.apify import apify
from app.services.hermes.providers.serp_google_jobs import serp
from app.services.hermes.providers.crawl4ai import crawl4ai

# Order matters for the router's generic-search fallback: keyless ATS first.
ALL_PROVIDERS: list = [
    greenhouse,
    lever,
    ashby,
    workday,
    serp,
    firecrawl,
    apify,
    crawl4ai,
]

__all__ = [
    "greenhouse",
    "lever",
    "ashby",
    "workday",
    "firecrawl",
    "apify",
    "serp",
    "crawl4ai",
    "ALL_PROVIDERS",
]