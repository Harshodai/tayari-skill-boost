"""ScrapingProvider protocol shared by every Hermes provider.

Providers are duck-typed: any object exposing the attributes/methods below
can be routed by ``router.select_tier`` and run by ``HermesScraper``. Every
provider normalizes its raw results through ``job_providers._norm`` so the
downstream ranking/cache layers need no per-provider handling.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

import httpx


@runtime_checkable
class ScrapingProvider(Protocol):
    """A single job-scraping source.

    Attributes:
        name: Stable identifier (e.g. ``"greenhouse"``, ``"firecrawl"``).
        tier: Routing bucket - one of ``"ats"``, ``"firecrawl"``, ``"apify"``,
            ``"serp"``, ``"crawl4ai"``.
        requires_key: True when an external API key is mandatory; ATS JSON
            providers are keyless.
        board_class: ATS board class this provider serves (``"greenhouse"``,
            ...) or ``None`` for query-targeted providers (serp/firecrawl/...).
    """

    name: str
    tier: str
    requires_key: bool
    board_class: str | None

    def available(self) -> bool: ...

    async def fetch(
        self,
        client: httpx.AsyncClient,
        query: str,
        location: str = "",
        board: dict | None = None,
    ) -> list[dict]: ...