"""Thompson Sampling Proxy Pool for Hermes Scraper.

Inspired by AnakinScraper Multi-Armed Bandit architecture:
Selects proxies using Thompson Sampling (Beta distribution) per domain, learning from
success/failure in real time to maximize scraping success rates.
"""

from __future__ import annotations

import logging
import random
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


class ThompsonProxySampler:
    """Thompson Sampling proxy selection engine for web scrapers."""

    def __init__(self, proxy_list: List[str]):
        self.proxies = proxy_list
        # Key: (domain, proxy_url) -> [success_count, failure_count]
        self._stats: Dict[Tuple[str, str], List[int]] = {}

    def select_proxy(self, domain: str) -> str:
        """Select optimal proxy for a domain using Beta distribution sampling."""
        if not self.proxies:
            return "direct"

        best_proxy = self.proxies[0]
        best_sample = -1.0

        for proxy in self.proxies:
            key = (domain, proxy)
            stats = self._stats.get(key, [1, 1])  # Prior: Beta(1, 1)
            successes, failures = stats[0], stats[1]

            # Sample from Beta distribution
            sample = random.betavariate(successes + 1, failures + 1)
            if sample > best_sample:
                best_sample = sample
                best_proxy = proxy

        return best_proxy

    def record_result(self, domain: str, proxy: str, success: bool) -> None:
        """Record success or failure to update Thompson Sampling Beta parameters."""
        if proxy == "direct":
            return
        key = (domain, proxy)
        if key not in self._stats:
            self._stats[key] = [1, 1]

        if success:
            self._stats[key][0] += 1
        else:
            self._stats[key][1] += 1

        logger.debug("Thompson sampler updated for (%s, %s): %s", domain, proxy, self._stats[key])
