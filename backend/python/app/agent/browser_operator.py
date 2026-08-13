import asyncio
import base64
import logging
import re
from typing import Dict, Any, List, Optional

from app.services.prompt_safety import untrusted

logger = logging.getLogger(__name__)

class BrowserOperator:
    """Playwright-driven browser automation with SSRF and redirect guards.

    Observation is accessibility-tree first: :meth:`observe` returns a role/name
    tree in which every interactive element carries a stable ``ref_N`` handle,
    and :meth:`click` / :meth:`fill` accept either a ref or a raw CSS selector.
    Refs address elements semantically, so they survive the re-layout that
    breaks selectors on single-page ATS forms — but they are only valid until
    the DOM changes, so the map is discarded on navigation and after any action
    that mutates the page. Re-:meth:`observe` after either.

    :meth:`screenshot` exists for the cases a tree cannot answer (visual layout,
    rendering bugs). It is the fallback, not the primary read.
    """

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        self.playwright = None
        # ref_N -> Locator for the current DOM generation. Invalidated on
        # navigation and after any mutating action.
        self._refs: Dict[str, Any] = {}

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

    async def navigate(self, url: str, headers: Optional[Dict[str, str]] = None, validate_redirects: bool = False, respect_robots: bool = True) -> Dict[str, Any]:
        """Navigate to target URL and retrieve simplified page text & metadata.

        When ``headers`` is provided, its entries are applied as extra HTTP
        headers for this navigation only (the context is reset afterward so they
        cannot leak to later origins). When ``validate_redirects`` is true, every
        redirect destination is re-checked against the SSRF URL guard and the
        navigation is aborted if any hop targets a private or non-public host.

        Legal boundary: robots.txt + outbound backoff are enforced before the
        navigation. A URL disallowed by robots.txt returns
        ``{"success": False, "error": "robots.txt disallows <url>"}`` and is
        logged; the caller treats this the same as any other navigation
        failure. When hosted mode is on, the URL must also be a licensed
        feed origin (fail-closed), else the navigation is skipped with
        ``{"success": False, "licensed_blocked": True}``.

        robots.txt + outbound backoff are enforced when ``respect_robots`` is
        True (default — bulk discovery/scraping). Interactive user-directed
        single-page actions (e.g. an ATS application form the user chose to
        fill) pass ``respect_robots=False``; the licensed-source gate runs
        regardless.
        """
        # Legal boundary first: hosted-mode licensed gate (always) + robots.txt
        # gate + per-domain backoff (the robots-compliance path).
        from app.services.scraping_policy import (
            aassert_robots_allowed,
            assert_licensed_source,
            LicensedSourceError,
            RobotsDisallowedError,
            await_backoff,
        )
        try:
            assert_licensed_source(url)
        except LicensedSourceError as exc:
            logger.info("SKIPPED: hosted mode restricts scraping to licensed feeds (%s)", url)
            return {"success": False, "error": str(exc), "licensed_blocked": True}
        if respect_robots:
            try:
                await aassert_robots_allowed(url)
            except RobotsDisallowedError as exc:
                logger.info("SKIPPED: robots.txt disallows %s", url)
                return {"success": False, "error": f"robots.txt disallows {url!r}", "robots_blocked": True}
            await await_backoff(url)

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
            # New document: every ref from the previous page is now stale.
            self._refs = {}
            title = await self.page.title()
            content = await self.page.evaluate("() => document.body.innerText.slice(0, 3000)")
            # `content_preview` is attacker-controlled page text, and this
            # method backs the `navigate_web` MCP tool — so it flows straight
            # into the model's context. Fence it here, at the boundary where the
            # untrusted data enters, rather than trusting each call site to
            # remember. `title` is left raw: no caller feeds it to a model
            # (omnisave reads `page.title()` directly), and fencing short
            # metadata only risks delimiters leaking into displayed text.
            #
            # Callers that render this to a user rather than to a model must
            # strip the fence — see `prompt_safety.untrusted` for the markers.
            return {
                "success": True,
                "url": self.page.url,
                "title": title,
                "status": response.status if response else 200,
                "content_preview": untrusted(content)
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
            # ponytail: fail closed — any error resolving or validating a
            # redirect destination aborts the route rather than continuing
            # unvalidated, mirroring _ssrf_route_interceptor. Every redirect is
            # either continued (validated public) or aborted; never left
            # unresolved.
            try:
                from app.agent.agent_engine import _is_safe_url
                if not _is_safe_url(request.url):
                    logger.warning(f"SSRF Redirect Interceptor blocked unsafe redirect: {request.url}")
                    await route.abort("blockedbyclient")
                    return
            except Exception as exc:
                logger.warning(f"SSRF Redirect Interceptor error: {exc}")
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

    # Roles that represent something an agent can act on.
    _INTERACTIVE_ROLES = (
        "textbox", "searchbox", "combobox", "button", "checkbox",
        "radio", "link", "menuitem", "option", "slider", "switch",
    )

    _TREE_LINE_PATTERN = re.compile(
        r'\s*-\s+(' + "|".join(_INTERACTIVE_ROLES) + r')(?:\s+"((?:[^"\\]|\\.)*)")?'
    )

    @classmethod
    def _parse_accessibility_tree(cls, tree: str) -> List[Dict[str, Any]]:
        """Pure parse of `Locator.aria_snapshot()` YAML into ordered elements.

        Returns ``[{"role", "name", "index"}, …]``. ``index`` disambiguates
        repeated ``(role, name)`` pairs by order of appearance — the same
        count Playwright's ``.nth()`` uses — so the caller can build a
        ``Locator`` without redoing this bookkeeping. Kept free of any
        Playwright object so it is unit-testable without a real page.
        """
        elements: List[Dict[str, Any]] = []
        role_seen: Dict[tuple, int] = {}
        for line in (tree or "").splitlines():
            match = cls._TREE_LINE_PATTERN.match(line)
            if not match:
                continue
            role = match.group(1)
            name = (match.group(2) or "").replace('\\"', '"')
            index = role_seen.get((role, name), 0)
            role_seen[(role, name)] = index + 1
            elements.append({"role": role, "name": name, "index": index})
        return elements

    async def observe(self) -> Dict[str, Any]:
        """Read the page as an accessibility tree with stable element refs.

        Returns ``{"success", "url", "elements": [{"ref", "role", "name"}, …]}``.
        Each ``ref`` is usable with :meth:`click` and :meth:`fill` until the DOM
        changes. Prefer this over :meth:`screenshot` for locating and verifying
        content: it is deterministic, costs no vision tokens, and does not
        depend on pixel positions.
        """
        if not self.page:
            return {"success": False, "error": "Browser page not open."}
        try:
            tree = await self.page.locator("body").aria_snapshot()
        except Exception as e:
            # Fail loudly. An empty element list is indistinguishable from a
            # page with no controls, and callers gate on that.
            logger.error("Accessibility snapshot failed: %s", e)
            return {"success": False, "error": f"accessibility snapshot failed: {e}"}

        self._refs = {}
        elements = []
        for parsed in self._parse_accessibility_tree(tree):
            role, name, index = parsed["role"], parsed["name"], parsed["index"]
            ref = f"ref_{len(elements) + 1}"
            locator = (
                self.page.get_by_role(role, name=name, exact=True).nth(index)
                if name
                else self.page.get_by_role(role).nth(index)
            )
            self._refs[ref] = locator
            elements.append({"ref": ref, "role": role, "name": name})

        return {"success": True, "url": self.page.url, "elements": elements}

    async def screenshot(self, full_page: bool = False) -> Dict[str, Any]:
        """Capture a PNG of the current page, base64-encoded.

        The fallback read. Use :meth:`observe` for text and structure.
        """
        if not self.page:
            return {"success": False, "error": "Browser page not open."}
        try:
            raw = await self.page.screenshot(full_page=full_page)
            return {
                "success": True,
                "url": self.page.url,
                "format": "png",
                "data": base64.b64encode(raw).decode("ascii"),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _resolve(self, target: str):
        """Return a Locator for a ``ref_N`` handle, or None if it isn't one."""
        return self._refs.get(target)

    async def click(self, target: str) -> Dict[str, Any]:
        """Click an element by ``ref_N`` handle, or by CSS selector.

        A ref from a previous DOM generation is reported as stale rather than
        silently retried as a selector — that would be an unrelated element.
        """
        if not self.page:
            return {"success": False, "error": "Browser page not open."}
        locator = self._resolve(target)
        if locator is None and target.startswith("ref_"):
            return {"success": False, "error": f"stale or unknown ref '{target}'; call observe() again"}
        try:
            if locator is not None:
                await locator.click(timeout=5000)
            else:
                await self.page.click(target, timeout=5000)
            # The click may have mutated or navigated the page.
            self._refs = {}
            return {"success": True, "action": f"Clicked '{target}'"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def fill(self, target: str, text: str) -> Dict[str, Any]:
        """Fill an input by ``ref_N`` handle, or by CSS selector."""
        if not self.page:
            return {"success": False, "error": "Browser page not open."}
        locator = self._resolve(target)
        if locator is None and target.startswith("ref_"):
            return {"success": False, "error": f"stale or unknown ref '{target}'; call observe() again"}
        try:
            if locator is not None:
                await locator.fill(text, timeout=5000)
            else:
                await self.page.fill(target, text, timeout=5000)
            return {"success": True, "action": f"Filled input at '{target}'"}
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
