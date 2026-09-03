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
    """Manages (user_id, domain) session cookies for Playwright scrapers."""

    def __init__(self):
        # (user_id, domain) -> List of cookie dicts
        self._cookies: Dict[tuple[str, str], List[Dict[str, Any]]] = {}

    def set_cookies(self, domain: str, cookies: List[Dict[str, Any]], user_id: str = "default") -> None:
        """Store cookie list for a (user_id, domain) pair."""
        key = (user_id or "default", domain)
        self._cookies[key] = cookies
        logger.debug("Stored %d cookies for user %s on domain %s", len(cookies), user_id, domain)

    def get_cookies(self, domain: str, user_id: str = "default") -> List[Dict[str, Any]]:
        """Retrieve stored cookies for a (user_id, domain) pair."""
        key = (user_id or "default", domain)
        return self._cookies.get(key, [])

    def clear_cookies(self, domain: Optional[str] = None, user_id: Optional[str] = None) -> None:
        """Clear cookies for a specific (user_id, domain) pair, domain, user, or all."""
        if user_id is not None and not user_id:
            user_id = "default"
        if domain and user_id:
            self._cookies.pop((user_id, domain), None)
        elif domain:
            to_del = [k for k in self._cookies if k[1] == domain]
            for k in to_del:
                self._cookies.pop(k, None)
        elif user_id:
            to_del = [k for k in self._cookies if k[0] == user_id]
            for k in to_del:
                self._cookies.pop(k, None)
        else:
            self._cookies.clear()
