"""Crawl4AI provider (in-process, no key, LLM-ready markdown).

Runs ``AsyncWebCrawler`` in-process. When the ``crawl4ai`` package is not
installed the provider degrades to [] (``available()`` stays True so the
router selects it; the fetch guards the import). URL-targeted like Firecrawl
but uses a lightweight regex/heading extraction instead of an LLM call.
"""
from __future__ import annotations

import logging
import re

import httpx

from app.services.hermes.normalize import _norm

logger = logging.getLogger(__name__)

BOARD_CLASS = None
TIER = "crawl4ai"
REQUIRES_KEY = False

# Heuristics for pulling structured fields out of a markdown JD.
_TITLE_RE = re.compile(r"^#{1,3}\s*(.+)$")
_LOCATION_RE = re.compile(r"location[:\s]+([^\n|]+)", re.IGNORECASE)
_COMPANY_RE = re.compile(r"company[:\s]+([^\n|]+)", re.IGNORECASE)


class Crawl4AIProvider:
    name = "crawl4ai"
    tier = TIER
    requires_key = REQUIRES_KEY
    board_class = BOARD_CLASS

    def available(self) -> bool:
        return True  # degrades to [] if import fails inside fetch

    async def fetch(
        self,
        client: httpx.AsyncClient,
        query: str,
        location: str = "",
        board: dict | None = None,
    ) -> list[dict]:
        url = (board or {}).get("url")
        if not url:
            return []
        markdown = await self._crawl(url)
        if not markdown:
            return []
        return _extract_from_markdown(markdown, url)

    async def _crawl(self, url: str) -> str:
        try:
            from crawl4ai import AsyncWebCrawler  # lazy import
        except ImportError:
            logger.warning("crawl4ai: package not installed, skipping")
            return ""
        try:
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url=url)
                return getattr(result, "markdown", "") or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("crawl4ai: crawl failed (%s)", exc)
            return ""


def _extract_from_markdown(markdown: str, source_url: str) -> list[dict]:
    lines = markdown.splitlines()
    title = ""
    for line in lines:
        m = _TITLE_RE.match(line.strip())
        if m:
            title = m.group(1).strip()
            break
    if not title and lines:
        title = lines[0].strip().lstrip("#").strip()
    loc_match = _LOCATION_RE.search(markdown)
    company_match = _COMPANY_RE.search(markdown)
    return [_norm(
        source="crawl4ai",
        title=title,
        company=(company_match.group(1).strip() if company_match else ""),
        location=(loc_match.group(1).strip() if loc_match else ""),
        url=source_url,
        description=markdown[:1500],
    )]


crawl4ai = Crawl4AIProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    """Shim: Crawl4AI is URL-targeted; generic queries return []."""
    return []