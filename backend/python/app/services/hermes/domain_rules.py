"""Domain Configuration Rules & Failure Detector.

Inspired by AnakinScraper domain configs architecture:
Per-domain scraping strategy rules: failure pattern detection (CAPTCHA, Cloudflare, 403 Forbidden),
wait timeouts, custom headers, and automatic fallback trigger rules.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DomainRulesEngine:
    """Per-domain scraping rules and block/CAPTCHA failure detector."""

    BLOCK_PATTERNS = [
        r"verify\s+you\s+are\s+human",
        r"cloudflare",
        r"access\s+denied",
        r"403\s+forbidden",
        r"please\s+enable\s+js",
        r"captcha",
        r"robot\s+check"
    ]

    @staticmethod
    def detect_scraping_failure(raw_html_or_text: str) -> Dict[str, Any]:
        """Inspect raw scraped content for anti-bot or CAPTCHA blocking patterns."""
        if not raw_html_or_text or len(raw_html_or_text.strip()) < 20:
            return {"is_blocked": True, "reason": "Empty or near-empty content"}


        text_lower = raw_html_or_text.lower()
        for pattern in DomainRulesEngine.BLOCK_PATTERNS:
            if re.search(pattern, text_lower):
                return {
                    "is_blocked": True,
                    "reason": f"Detected anti-bot pattern: '{pattern}'",
                    "requires_browser_fallback": True
                }

        return {"is_blocked": False, "reason": "Clean content"}
