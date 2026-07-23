"""Greenhouse ATS provider (keyless).

Greenhouse exposes a public JSON board API at
``https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true``.
No auth required. When no board token is supplied the shim iterates a small
list of well-known public board tokens so generic queries still return real
ATS jobs without any credentials.
"""
from __future__ import annotations

import logging

import httpx

from app.services.hermes.normalize import _norm, UA

logger = logging.getLogger(__name__)

BOARD_CLASS = "greenhouse"
TIER = "ats"
REQUIRES_KEY = False
BASE_URL = "https://boards-api.greenhouse.io/v1/boards"

# A handful of well-known public Greenhouse boards. Used only when the caller
# does not pass a specific board token; safe to extend.
DEFAULT_TOKENS: tuple[str, ...] = ("airbnb", "stripe", "dropbox")


class GreenhouseProvider:
    name = "greenhouse"
    tier = TIER
    requires_key = REQUIRES_KEY
    board_class = BOARD_CLASS

    def available(self) -> bool:
        return True  # keyless

    async def fetch(
        self,
        client: httpx.AsyncClient,
        query: str,
        location: str = "",
        board: dict | None = None,
    ) -> list[dict]:
        tokens = _resolve_tokens(board)
        if not tokens:
            return []
        results: list[dict] = []
        for token in tokens:
            results.extend(await self._fetch_board(client, token, query))
        return results

    async def _fetch_board(
        self, client: httpx.AsyncClient, token: str, query: str,
    ) -> list[dict]:
        try:
            resp = await client.get(
                f"{BASE_URL}/{token}/jobs",
                params={"content": "true"},
                headers=UA,
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # noqa: BLE001 - provider must never raise
            logger.warning("greenhouse: board '%s' failed (%s)", token, exc)
            return []

        q = (query or "").lower()
        out: list[dict] = []
        for job in data.get("jobs", []):
            title = job.get("title", "")
            if q and not _matches(title, q):
                continue
            loc_obj = job.get("location") or {}
            tags = [d.get("name", "") for d in job.get("departments", []) if d.get("name")]
            out.append(_norm(
                source="greenhouse",
                title=title,
                company=token,  # board token as company proxy
                location=loc_obj.get("name", ""),
                url=job.get("absolute_url", ""),
                description=job.get("content", ""),
                tags=tags,
            ))
        return out


def _resolve_tokens(board: dict | None) -> list[str]:
    if board and board.get("token"):
        return [board["token"]]
    return list(DEFAULT_TOKENS)


def _matches(title: str, query_lower: str) -> bool:
    haystack = (title or "").lower()
    return all(part in haystack for part in query_lower.split()[:3])


# Module-level singleton for registry import.
greenhouse = GreenhouseProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    """job_providers.PROVIDERS-compatible shim (no board)."""
    return await greenhouse.fetch(client, query, location, board=None)