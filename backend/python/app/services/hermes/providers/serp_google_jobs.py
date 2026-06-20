"""SerpApi Google Jobs provider (key-gated, query+location targeted).

Hits ``https://serpapi.com/search?engine=google_jobs&q=...&location=...``.
Degrades to [] when the API key is absent.
"""
from __future__ import annotations

import logging

import httpx

from app.services.hermes.config import SERPAPI_API_KEY, serp_available
from app.services.hermes.normalize import _norm

logger = logging.getLogger(__name__)

BOARD_CLASS = None
TIER = "serp"
REQUIRES_KEY = True
BASE_URL = "https://serpapi.com/search"


class SerpProvider:
    name = "serp"
    tier = TIER
    requires_key = REQUIRES_KEY
    board_class = BOARD_CLASS

    def available(self) -> bool:
        return serp_available()

    async def fetch(
        self,
        client: httpx.AsyncClient,
        query: str,
        location: str = "",
        board: dict | None = None,
    ) -> list[dict]:
        if not self.available():
            return []
        params = {
            "engine": "google_jobs",
            "q": query,
            "location": location,
            "api_key": SERPAPI_API_KEY,
        }
        try:
            resp = await client.get(BASE_URL, params=params, timeout=20)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("serp: fetch failed (%s)", exc)
            return []

        out: list[dict] = []
        for job in data.get("jobs_results", []) or []:
            via = job.get("via", {}) or {}
            extensions = via.get("extensions") or []
            description = " ".join(extensions) if isinstance(extensions, list) else ""
            if not description:
                description = job.get("description", "")
            out.append(_norm(
                source="serp",
                title=job.get("title", ""),
                company=job.get("company_name", ""),
                location=job.get("location", ""),
                url=job.get("related_links", [{}])[0].get("link", "") if job.get("related_links") else "",
                description=description,
            ))
        return out


serp = SerpProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    return await serp.fetch(client, query, location, board=None)