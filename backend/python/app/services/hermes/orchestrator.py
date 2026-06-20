"""HermesScraper - the tiered orchestrator.

Selects providers via ``router.select_tier``, runs the available set in
parallel under per-provider ``CircuitBreaker`` instances, merges via
``job_providers._dedupe``, and optionally enriches short listings with a
full-JD fetch (Firecrawl/Crawl4AI). Every provider failure degrades to an
empty list so a scrape never raises.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Callable

import httpx

from app.services.circuit_breaker import CircuitBreaker, CircuitBreakerOpen
from app.services.hermes.cache import get_cached, write_cached
from app.services.hermes.normalize import _classify_board
from app.services.hermes.providers import ALL_PROVIDERS
from app.services.hermes.router import select_tier
from app.services.job_providers import _dedupe

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 40
FAILURE_THRESHOLD = 5
RECOVERY_TIMEOUT = 60.0
ENRICH_MIN_DESC_LEN = 200  # enrich listings whose description is shorter than this


class HermesScraper:
    """Tiered job scraper with per-provider circuit breakers."""

    def __init__(
        self,
        providers: list | None = None,
        breaker_factory: Callable[..., CircuitBreaker] | None = None,
    ):
        self.providers = list(providers) if providers is not None else list(ALL_PROVIDERS)
        self._breaker_factory = breaker_factory or _default_breaker
        # One breaker per provider, keyed by provider name. Each breaker
        # wraps the provider's ``fetch`` coroutine so successes/failures are
        # recorded automatically and ``CircuitBreakerOpen`` is raised when open.
        self._breakers: dict[str, CircuitBreaker] = {}
        self._wrapped: dict[str, Callable] = {}
        for provider in self.providers:
            breaker = self._breaker_factory(
                failure_threshold=FAILURE_THRESHOLD,
                recovery_timeout=RECOVERY_TIMEOUT,
                name=f"hermes.{provider.name}",
            )
            self._breakers[provider.name] = breaker
            self._wrapped[provider.name] = breaker(provider.fetch)

    async def scrape(
        self,
        query: str,
        location: str = "",
        board: dict | None = None,
        limit: int = DEFAULT_LIMIT,
    ) -> list[dict]:
        """Run the selected tier in parallel, merge + dedupe, return jobs."""
        board_class = _board_class(board)
        cached = await get_cached(board_class, query, location)
        if cached is not None:
            logger.debug("hermes: cache hit for %s/%s/%s", board_class, query, location)
            return cached[:limit]

        selected = select_tier(board, self.providers)
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            batches = await asyncio.gather(*[
                self.scrape_one(p, client, query, location, board) for p in selected
            ])
        jobs = _dedupe([j for batch in batches for j in batch])

        await _persist(self, board_class, board, query, location, selected, jobs)
        return jobs[:limit]

    async def scrape_one(
        self,
        provider,
        client: httpx.AsyncClient,
        query: str,
        location: str,
        board: dict | None,
    ) -> list[dict]:
        """Run a single provider under its breaker; return [] on any failure."""
        wrapped = self._wrapped.get(provider.name)
        if wrapped is None:
            return []
        try:
            return await wrapped(client, query, location, board)
        except CircuitBreakerOpen as exc:
            logger.info("hermes: %s skipped (breaker open: %s)", provider.name, exc)
            return []
        except Exception as exc:  # noqa: BLE001 - provider must not crash the batch
            logger.warning("hermes: %s failed (%s)", provider.name, exc)
            return []

    async def enrich(self, jobs: list[dict]) -> list[dict]:
        """Fetch full JD text for short listings when a URL provider is up."""
        from app.services.hermes.providers import firecrawl, crawl4ai  # noqa: F811
        enrichers = [p for p in (firecrawl, crawl4ai) if p.available()]
        if not enrichers:
            return jobs
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            tasks = [self._enrich_one(client, enrichers, job) for job in jobs]
            results = await asyncio.gather(*tasks)
        return list(results)

    async def _enrich_one(
        self,
        client: httpx.AsyncClient,
        enrichers: list,
        job: dict,
    ) -> dict:
        if len(job.get("description", "")) >= ENRICH_MIN_DESC_LEN or not job.get("url"):
            return job
        board = {"url": job["url"]}
        for enricher in enrichers:
            try:
                fetched = await enricher.fetch(client, query="", location="", board=board)
            except Exception:  # noqa: BLE001
                fetched = []
            if fetched and fetched[0].get("description"):
                enriched = dict(job)
                enriched["description"] = fetched[0]["description"]
                return enriched
        return job


def _default_breaker(
    failure_threshold: int = FAILURE_THRESHOLD,
    recovery_timeout: float = RECOVERY_TIMEOUT,
    name: str = "default",
) -> CircuitBreaker:
    """Build a fresh CircuitBreaker (not shared with the global registry)."""
    return CircuitBreaker(
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        name=name,
    )


def _board_class(board: dict | None) -> str | None:
    if not board:
        return None
    if board.get("class"):
        return board["class"]
    classified = _classify_board(board.get("url") or board.get("token"))
    return classified.get("class") if isinstance(classified, dict) else None


async def _persist(
    scraper: "HermesScraper",
    board_class: str | None,
    board: dict | None,
    query: str,
    location: str,
    selected: list,
    jobs: list[dict],
) -> None:
    """Write the batch to the cache, attributed to the providers that ran."""
    if not jobs:
        return
    sources = ",".join(sorted({p.name for p in selected}))
    token = (board or {}).get("token")
    await write_cached(sources, board_class, token, query, location, jobs)