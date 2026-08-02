import asyncio
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class BrowserOperator:
    """
    Browser Operator & Cloud Browser Engine.
    Implements Playwright-driven browser automation, DOM accessibility tree parsing,
    and screenshot capture for spatial vision reasoning (Manus & Claude Computer Use paradigm).
    """

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        self.playwright = None

    async def initialize(self):
        """Initialize Playwright chromium instance."""
        try:
            from playwright.async_api import async_playwright
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless
            )
            self.context = await self.browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36"
            )

            async def _ssrf_route_interceptor(route, request):
                req_url = request.url
                try:
                    from app.agent.agent_engine import _is_safe_url
                    if not _is_safe_url(req_url):
                        logger.warning(f"SSRF Transport Interceptor blocked request to unsafe destination: {req_url}")
                        await route.abort("blockedbyclient")
                        return
                except Exception as exc:
                    logger.warning(f"SSRF Interceptor error: {exc}")
                    await route.abort("blockedbyclient")
                    return
                await route.continue_()

            await self.context.route("**/*", _ssrf_route_interceptor)
            self.page = await self.context.new_page()
            return True
        except Exception as e:
            logger.warning(f"BrowserOperator Initialization Warning: {e}")
            await self.close()
            return False

    async def navigate(self, url: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Navigate to target URL and retrieve simplified page text & metadata."""
        if not self.page:
            init_ok = await self.initialize()
            if not init_ok or not self.page:
                return {"success": False, "error": "Browser engine not initialized (Playwright missing or restricted)."}

        try:
            response = await self.page.goto(url, wait_until="networkidle", timeout=20000, headers=headers or {})
            title = await self.page.title()
            content = await self.page.evaluate("() => document.body.innerText.slice(0, 3000)")
            return {
                "success": True,
                "url": self.page.url,
                "title": title,
                "status": response.status if response else 200,
                "content_preview": content
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def click(self, selector: str) -> Dict[str, Any]:
        """Click element by selector or text content."""
        if not self.page:
            return {"success": False, "error": "Browser page not open."}
        try:
            await self.page.click(selector, timeout=5000)
            return {"success": True, "action": f"Clicked '{selector}'"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def fill(self, selector: str, text: str) -> Dict[str, Any]:
        """Fill input element with text."""
        if not self.page:
            return {"success": False, "error": "Browser page not open."}
        try:
            await self.page.fill(selector, text, timeout=5000)
            return {"success": True, "action": f"Filled input at selector '{selector}'"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def close(self):
        """Close browser resources."""
        self.page = None
        if self.context:
            try:
                await self.context.close()
            except Exception:
                pass
            self.context = None
        if self.browser:
            try:
                await self.browser.close()
            except Exception:
                pass
            self.browser = None
        if self.playwright:
            try:
                await self.playwright.stop()
            except Exception:
                pass
            self.playwright = None
