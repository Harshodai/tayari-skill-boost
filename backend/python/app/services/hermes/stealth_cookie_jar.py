"""Stealth Cookie Jar & Session Manager.

Inspired by AnakinScraper cookie jar and session manager:
Stores, refreshes, and injects domain-specific session cookies into Playwright browser contexts
to maintain authentication state across scraper requests.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class StealthCookieJar:
    """Manages domain session cookies for Playwright scrapers."""

    def __init__(self):
        # Domain -> List of cookie dicts
        self._cookies: Dict[str, List[Dict[str, Any]]] = {}

    def set_cookies(self, domain: str, cookies: List[Dict[str, Any]]) -> None:
        """Store cookie list for a domain."""
        self._cookies[domain] = cookies
        logger.debug("Stored %d cookies for domain %s", len(cookies), domain)

    def get_cookies(self, domain: str) -> List[Dict[str, Any]]:
        """Retrieve stored cookies for a domain."""
        return self._cookies.get(domain, [])

    def clear_cookies(self, domain: Optional[str] = None) -> None:
        """Clear cookies for a specific domain or all domains."""
        if domain:
            self._cookies.pop(domain, None)
        else:
            self._cookies.clear()
