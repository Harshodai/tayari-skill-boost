"""Tiered provider selection.

``select_tier`` orders providers for a given scrape request:

* If a board with a known class is supplied, the matching ATS provider runs
  first (cheapest, keyless, structured), then key-requiring tiers follow as
  fallback.
* Otherwise the priority is: keyless ATS shims -> SerpApi -> Firecrawl/Apify
  -> Crawl4AI.

Only providers whose ``available()`` is True are returned, so the
orchestrator can run the whole list in parallel without re-checking keys.
"""
from __future__ import annotations

from typing import Iterable

from app.services.hermes.normalize import _classify_board

# Routing priority buckets (most-preferred first within each scenario).
_ATS_FIRST: tuple[str, ...] = ("ats",)
_GENERIC_ORDER: tuple[str, ...] = ("ats", "serp", "firecrawl", "apify", "crawl4ai")
_FALLBACK_AFTER_BOARD: tuple[str, ...] = ("serp", "firecrawl", "apify", "crawl4ai")


def select_tier(board: dict | None, available_providers: Iterable) -> list:
    """Return providers to run, ordered by preference, filtered to available.

    ``available_providers`` is any iterable of provider objects implementing
    the ``ScrapingProvider`` protocol (``name``, ``tier``, ``board_class``,
    ``available()``, ``fetch``).
    """
    providers = list(available_providers)
    available = [p for p in providers if p.available()]

    board_class = None
    if board:
        classified = board.get("class") or _classify_board(board.get("url") or board.get("token"))
        if isinstance(classified, dict):
            board_class = classified.get("class")

    if board_class:
        # Matching ATS provider first, then the non-ATS fallback tiers.
        matching = [p for p in available if p.board_class == board_class]
        fallback = [p for p in available if p.tier in _FALLBACK_AFTER_BOARD]
        # De-duplicate preserving order.
        seen: set[str] = set()
        ordered: list = []
        for group in (matching, fallback):
            for p in group:
                if p.name not in seen:
                    seen.add(p.name)
                    ordered.append(p)
        return ordered

    # Generic search: follow the global priority order.
    by_tier: dict[str, list] = {}
    for p in available:
        by_tier.setdefault(p.tier, []).append(p)
    ordered = []
    for tier in _GENERIC_ORDER:
        for p in by_tier.get(tier, []):
            ordered.append(p)
    # Any leftover tiers not enumerated above (defensive).
    for p in available:
        if p.tier not in _GENERIC_ORDER and p not in ordered:
            ordered.append(p)
    return ordered