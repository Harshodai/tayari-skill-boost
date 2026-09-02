"""Local Playwright Provider for Hermes Scraper.

Renders pages locally via Playwright headless browser, bypasses client-side rendering,
strips HTML boilerplate, and extracts clean job posting markdown and metadata.
Zero external paid API dependencies.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional
import httpx

from app.services.hermes.provider_base import ScrapingProvider


logger = logging.getLogger(__name__)

_PLAYWRIGHT_AVAILABLE: bool = False
try:
    from playwright.async_api import async_playwright
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False


class PlaywrightLocalProvider:
    """Local headless Playwright provider for JS-heavy job portals."""

    name = "playwright_local"
    tier = "playwright"
    requires_key = False
    board_class = None

    def available(self) -> bool:
        """Check if Playwright is installed in environment."""
        return _PLAYWRIGHT_AVAILABLE


    async def fetch(
        self,
        client: httpx.AsyncClient,
        query: str,
        location: str = "",
        board: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch job posting URL or execute search using local Playwright."""
        if not self.available():
            logger.warning("Playwright is not available in environment.")
            return []

        url = board.get("url") if board else None
        if not url:
            logger.info("Playwright provider requires a URL in board config.")
            return []

        try:
            from app.services.agent_reach_transcribe import assert_safe_public_url
            assert_safe_public_url(url)
        except Exception as exc:
            logger.warning("Playwright local provider blocked unsafe URL '%s': %s", url, exc)
            return []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--host-resolver-rules=MAP 169.254.169.254 ~NOTFOUND, MAP 127.0.0.1 ~NOTFOUND, MAP ::1 ~NOTFOUND",
                        "--block-insecure-private-network-requests",
                    ]
                )
                # ponytail: browser is bound now, so closing it is guaranteed —
                # finally runs before the outer except returns, even on scrape failure
                try:
                    context = await browser.new_context(
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/122.0.0.0 Safari/537.36",
                        viewport={"width": 1280, "height": 800}
                    )

                    # Intercept all subresource / navigation requests to block internal SSRF
                    async def _route_guard(route):
                        req_url = route.request.url
                        try:
                            assert_safe_public_url(req_url)
                            await route.continue_()
                        except Exception:
                            await route.abort("blockedbyclient")

                    await context.route("**/*", _route_guard)

                    page = await context.new_page()

                    logger.info("Playwright local provider navigating to: %s", url)
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(2000)

                    # Extract title
                    title = await page.title()

                    # Extract main content text
                    text_content = await page.evaluate("""
                        () => {
                            const clone = document.body.cloneNode(true);
                            const toRemove = clone.querySelectorAll('script, style, nav, footer, header, iframe, svg, button');
                            toRemove.forEach(el => el.remove());
                            return clone.innerText || clone.textContent || '';
                        }
                    """)

                    clean_text = self._clean_markdown(text_content)

                    return [{
                        "title": title or "Job Posting",
                        "company": board.get("company", "Unknown"),
                        "location": location or board.get("location", "Remote / Unspecified"),
                        "url": url,
                        "description": clean_text,
                        "source": "playwright_local"
                    }]
                finally:
                    await browser.close()

        except Exception as exc:
            logger.error("Playwright local scraping failed for %s: %s", url, exc)
            return []

    def _clean_markdown(self, raw_text: str) -> str:
        """Strip redundant whitespace and structure paragraphs."""
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        # Remove consecutive duplicate lines
        deduped = []
        for line in lines:
            if not deduped or deduped[-1] != line:
                deduped.append(line)
        return "\n\n".join(deduped[:300])


# Export singleton instance
playwright_local = PlaywrightLocalProvider()
