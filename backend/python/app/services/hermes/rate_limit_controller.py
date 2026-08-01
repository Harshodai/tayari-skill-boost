"""Adaptive Scraper Rate Limiter & Backoff Controller.

Inspired by AnakinScraper RateLimitController architecture:
Token bucket rate-limiting and exponential backoff controller per domain to ensure
respectful, non-disruptive web scraping.
"""

from __future__ import annotations

import logging
import time
from typing import Dict, Tuple

logger = logging.getLogger(__name__)


class RateLimitController:
    """Token bucket rate limiter and backoff controller per domain."""

    def __init__(self, max_tokens: int = 10, refill_rate_per_sec: float = 2.0):
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate_per_sec
        # Domain -> (tokens, last_update_timestamp)
        self._buckets: Dict[str, Tuple[float, float]] = {}

    def allow_request(self, domain: str) -> bool:
        """Check if request to domain is permitted by rate limiter."""
        now = time.time()
        tokens, last_update = self._buckets.get(domain, (float(self.max_tokens), now))

        # Refill tokens
        elapsed = now - last_update
        tokens = min(self.max_tokens, tokens + elapsed * self.refill_rate)

        if tokens >= 1.0:
            self._buckets[domain] = (tokens - 1.0, now)
            return True

        self._buckets[domain] = (tokens, now)
        logger.warning("Rate limit hit for domain: %s", domain)
        return False
