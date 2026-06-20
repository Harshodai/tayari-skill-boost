"""Hermes env-gated configuration.

Every provider reads its credentials here. Providers whose key is absent
self-disable via their ``available()`` method so the orchestrator can skip
them without raising. ATS JSON providers need no key and are always on.
"""
from __future__ import annotations

import os
from typing import Callable

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _truthy(value: str | None) -> bool:
    """Return True when ``value`` is a non-empty, non-placeholder string."""
    if not value:
        return False
    cleaned = value.strip().upper()
    if cleaned in {"", "NONE", "NULL", "CHANGEME", "YOUR_KEY_HERE"}:
        return False
    return True


def _env(name: str, default: str = "") -> str:
    """Read an environment variable, returning ``default`` when unset/blank."""
    return os.environ.get(name, default) or default


# ---------------------------------------------------------------------------
# Keys + endpoints
# ---------------------------------------------------------------------------

FIRECRAWL_API_KEY: str = _env("FIRECRAWL_API_KEY")
FIRECRAWL_BASE_URL: str = _env("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev/v2")

APIFY_API_TOKEN: str = _env("APIFY_API_TOKEN")
SERPAPI_API_KEY: str = _env("SERPAPI_API_KEY")

CRAWL4AI_BASE_URL: str = _env("CRAWL4AI_BASE_URL")  # blank => in-process

HERMES_AGENT_URL: str = _env("HERMES_AGENT_URL")
HERMES_API_KEY: str = _env("HERMES_API_KEY")
HERMES_MODEL: str = _env("HERMES_MODEL", "hermes3:8b")

REDIS_URL: str = _env("REDIS_URL", "redis://redis:6379/0")
DATABASE_URL: str = _env("DATABASE_URL")

SCRAPE_CACHE_TTL_SECONDS: int = int(_env("SCRAPE_CACHE_TTL_SECONDS", "3600") or "3600")

# ---------------------------------------------------------------------------
# Per-provider availability
# ---------------------------------------------------------------------------

def firecrawl_available() -> bool:
    return _truthy(FIRECRAWL_API_KEY)


def apify_available() -> bool:
    return _truthy(APIFY_API_TOKEN)


def serp_available() -> bool:
    return _truthy(SERPAPI_API_KEY)


def crawl4ai_available() -> bool:
    # In-process Crawl4AI needs no key. Availability is confirmed at import
    # time inside the provider; this stays True so the router can select it
    # and the provider degrades to [] if the library is missing.
    return True


def hermes_llm_available() -> bool:
    return _truthy(HERMES_AGENT_URL) and _truthy(HERMES_API_KEY)


# Callable registry so tests/WS-F can monkeypatch gating centrally.
AVAILABLE_PROVIDERS: dict[str, Callable[[], bool]] = {
    "firecrawl": firecrawl_available,
    "apify": apify_available,
    "serp": serp_available,
    "crawl4ai": crawl4ai_available,
}