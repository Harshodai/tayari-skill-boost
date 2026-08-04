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

    async def navigate(self, url: str, headers: Optional[Dict[str, str]] = None, validate_redirects: bool = False) -> Dict[str, Any]:
        """Navigate to target URL and retrieve simplified page text & metadata.

        When ``headers`` is provided, its entries are applied as extra HTTP
        headers for this navigation only (the context is reset afterward so they
        cannot leak to later origins). When ``validate_redirects`` is true, every
        redirect destination is re-checked against the SSRF URL guard and the
        navigation is aborted if any hop targets a private or non-public host.
        """
        if not self.page:
            init_ok = await self.initialize()
            if not init_ok or not self.page:
                return {"success": False, "error": "Browser engine not initialized (Playwright missing or restricted)."}

        # ponytail: context.set_extra_http_headers persists for the lifetime of
        # the context and leaks across later origins/subresources. Apply headers
        # only around the navigation and reset them immediately after.
        extra_headers: Dict[str, str] = {}
        if self.context:
            await self.context.set_extra_http_headers({})
            if headers:
                extra_headers = {
                    k: v for k, v in headers.items()
                    if k.lower() not in ("referer", "cookie", "authorization")
                }

        try:
            if extra_headers and self.context:
                await self.context.set_extra_http_headers(extra_headers)

            if validate_redirects:
                redirect_validator = await self._install_redirect_validator()
            else:
                redirect_validator = None

            referer = (headers or {}).get("Referer")
            goto_kwargs: Dict[str, Any] = {"wait_until": "networkidle", "timeout": 20000}
            if referer:
                goto_kwargs["referer"] = referer
            response = await self.page.goto(url, **goto_kwargs)
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
        finally:
            if extra_headers and self.context:
                await self.context.set_extra_http_headers({})
            if validate_redirects and redirect_validator is not None:
                await self._uninstall_redirect_validator(redirect_validator)

    async def _install_redirect_validator(self):
        """Route-intercept so every redirect hop is re-checked by the SSRF guard.

        The initial navigation lands on a pinned, validated IP, but the server
        may redirect to another host (or even back to a hostname that now
        resolves to a private address). Each hop must pass the same public-IP
        validation as the original URL before it is allowed to proceed.

        Returns the installed handler so the caller owns it: unregistering
        removes only this handler, never the base ``_ssrf_route_interceptor``
        that was installed at context init.
        """
        if not self.context:
            return None

        async def _redirect_interceptor(route, request):
            from app.agent.agent_engine import _is_safe_url
            if not _is_safe_url(request.url):
                logger.warning(f"SSRF Redirect Interceptor blocked unsafe redirect: {request.url}")
                await route.abort("blockedbyclient")
                return
            await route.continue_()

        await self.context.route("**/*", _redirect_interceptor)
        return _redirect_interceptor

    async def _uninstall_redirect_validator(self, handler):
        """Remove the redirect interceptor, restoring the default SSRF guard."""
        if self.context:
            try:
                await self.context.unroute("**/*", handler=handler)
            except Exception:
                pass

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
