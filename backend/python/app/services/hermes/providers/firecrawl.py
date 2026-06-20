"""Firecrawl provider (key-gated, URL-targeted).

Firecrawl is URL-targeted, not query-targeted. ``fetch`` scrapes a career
page URL supplied via ``board.url`` and extracts structured job fields with
Firecrawl's /v2/extract. Without a board URL ``fetch`` returns []. The
provider also backs ``HermesScraper.enrich`` for full-JD fetches.
"""
from __future__ import annotations

import logging

import httpx

from app.services.hermes.config import FIRECRAWL_API_KEY, FIRECRAWL_BASE_URL, firecrawl_available
from app.services.hermes.normalize import _norm

logger = logging.getLogger(__name__)

BOARD_CLASS = None
TIER = "firecrawl"
REQUIRES_KEY = True

# JSON schema for structured job extraction.
EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "company": {"type": "string"},
        "location": {"type": "string"},
        "description": {"type": "string"},
        "url": {"type": "string"},
    },
}


class FirecrawlProvider:
    name = "firecrawl"
    tier = TIER
    requires_key = REQUIRES_KEY
    board_class = BOARD_CLASS

    def available(self) -> bool:
        return firecrawl_available()

    async def fetch(
        self,
        client: httpx.AsyncClient,
        query: str,
        location: str = "",
        board: dict | None = None,
    ) -> list[dict]:
        url = (board or {}).get("url")
        if not url:
            return []  # query-targeted scraping not supported
        return await self.scrape_url(client, url)

    async def scrape_url(self, client: httpx.AsyncClient, url: str) -> list[dict]:
        """Scrape a single URL and return a normalized list (0 or 1 item)."""
        if not self.available():
            return []
        headers = {"Authorization": f"Bearer {FIRECRAWL_API_KEY}"}
        try:
            resp = await client.post(
                f"{FIRECRAWL_BASE_URL}/extract",
                json={"urls": [url], "schema": EXTRACT_SCHEMA},
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("firecrawl: extract failed (%s)", exc)
            return []
        return _parse_extract(data, url)

    async def scrape_markdown(self, client: httpx.AsyncClient, url: str) -> str:
        """Return raw markdown for a URL (used by ``enrich``)."""
        if not self.available():
            return ""
        headers = {"Authorization": f"Bearer {FIRECRAWL_API_KEY}"}
        try:
            resp = await client.post(
                f"{FIRECRAWL_BASE_URL}/scrape",
                json={"url": url, "formats": ["markdown"]},
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", {}).get("markdown", "") or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("firecrawl: scrape failed (%s)", exc)
            return ""


def _parse_extract(data: dict, source_url: str) -> list[dict]:
    items = data.get("data") if isinstance(data, dict) else None
    if isinstance(items, list):
        out: list[dict] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            out.append(_norm(
                source="firecrawl",
                title=item.get("title", ""),
                company=item.get("company", ""),
                location=item.get("location", ""),
                url=item.get("url", source_url),
                description=item.get("description", ""),
            ))
        return out
    if isinstance(items, dict):
        return [_norm(
            source="firecrawl",
            title=items.get("title", ""),
            company=items.get("company", ""),
            location=items.get("location", ""),
            url=items.get("url", source_url),
            description=items.get("description", ""),
        )]
    return []


firecrawl = FirecrawlProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    """Shim: Firecrawl is URL-targeted; generic queries return []."""
    return []