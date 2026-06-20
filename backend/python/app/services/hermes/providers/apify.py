"""Apify provider (key-gated, query+location targeted).

Uses the ``apify-client`` Python SDK against the
``openclawai/job-board-scraper`` public Actor. The SDK call is synchronous, so
it is dispatched to a thread via ``asyncio.to_thread`` to stay non-blocking.
Degrades to [] when the SDK or token is missing.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from app.services.hermes.config import APIFY_API_TOKEN, apify_available
from app.services.hermes.normalize import _norm

logger = logging.getLogger(__name__)

BOARD_CLASS = None
TIER = "apify"
REQUIRES_KEY = True
ACTOR_ID = "openclawai/job-board-scraper"
DEFAULT_BOARD = "linkedin"


class ApifyProvider:
    name = "apify"
    tier = TIER
    requires_key = REQUIRES_KEY
    board_class = BOARD_CLASS

    def available(self) -> bool:
        if not apify_available():
            return False
        try:
            import apify_client  # noqa: F401 - import check only
            return True
        except ImportError:
            return False

    async def fetch(
        self,
        client: httpx.AsyncClient,
        query: str,
        location: str = "",
        board: dict | None = None,
    ) -> list[dict]:
        if not self.available():
            return []
        run_input = {
            "board": (board or {}).get("platform", DEFAULT_BOARD),
            "query": query,
            "location": location,
        }
        return await asyncio.to_thread(self._run_actor, run_input)

    def _run_actor(self, run_input: dict) -> list[dict]:
        try:
            from apify_client import ApifyClient
        except ImportError:
            logger.warning("apify: apify-client not installed")
            return []
        try:
            apify = ApifyClient(APIFY_API_TOKEN)
            actor = apify.actor(ACTOR_ID)
            run = actor.call(run_input=run_input)
            if not run:
                return []
            dataset = apify.dataset(run["defaultDatasetId"])
            items = dataset.list_items().items
        except Exception as exc:  # noqa: BLE001
            logger.warning("apify: actor run failed (%s)", exc)
            return []
        out: list[dict] = []
        for item in items or []:
            if not isinstance(item, dict):
                continue
            out.append(_norm(
                source="apify",
                title=item.get("title", ""),
                company=item.get("company", item.get("companyName", "")),
                location=item.get("location", ""),
                url=item.get("url", item.get("jobUrl", "")),
                description=item.get("description", ""),
                tags=item.get("tags", []) if isinstance(item.get("tags"), list) else None,
            ))
        return out


apify = ApifyProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    return await apify.fetch(client, query, location, board=None)