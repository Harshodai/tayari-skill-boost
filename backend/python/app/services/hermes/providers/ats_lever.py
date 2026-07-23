"""Lever ATS provider (keyless).

Lever exposes a public postings API at
``https://api.lever.co/v0/postings/{token}?mode=json``. No auth required.
When no board token is supplied the shim iterates a small list of well-known
public posting tokens.
"""
from __future__ import annotations

import logging

import httpx

from app.services.hermes.normalize import _norm, UA

logger = logging.getLogger(__name__)

BOARD_CLASS = "lever"
TIER = "ats"
REQUIRES_KEY = False
BASE_URL = "https://api.lever.co/v0/postings"

# Well-known public Lever posting tokens.
DEFAULT_TOKENS: tuple[str, ...] = ("lever", "shipt", "yelp")


class LeverProvider:
    name = "lever"
    tier = TIER
    requires_key = REQUIRES_KEY
    board_class = BOARD_CLASS

    def available(self) -> bool:
        return True

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
            results.extend(await self._fetch_token(client, token, query))
        return results

    async def _fetch_token(
        self, client: httpx.AsyncClient, token: str, query: str,
    ) -> list[dict]:
        try:
            resp = await client.get(
                f"{BASE_URL}/{token}",
                params={"mode": "json"},
                headers=UA,
                timeout=20,
            )
            resp.raise_for_status()
            postings = resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("lever: token '%s' failed (%s)", token, exc)
            return []

        q = (query or "").lower()
        out: list[dict] = []
        for p in postings or []:
            title = p.get("text", "")
            if q and not _matches(title, q):
                continue
            cats = p.get("categories", {}) or {}
            desc_parts = [lst.get("content", "") for lst in p.get("lists", []) if lst.get("content")]
            description = " ".join(desc_parts)
            out.append(_norm(
                source="lever",
                title=title,
                company=token,
                location=cats.get("location", ""),
                url=p.get("hostedUrl", ""),
                description=description,
                tags=_split_tags(cats.get("team"), cats.get("commitment")),
            ))
        return out


def _split_tags(*values: str) -> list[str]:
    return [v for v in values if v]


def _resolve_tokens(board: dict | None) -> list[str]:
    if board and board.get("token"):
        return [board["token"]]
    return list(DEFAULT_TOKENS)


def _matches(title: str, query_lower: str) -> bool:
    haystack = (title or "").lower()
    return all(part in haystack for part in query_lower.split()[:3])


lever = LeverProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    return await lever.fetch(client, query, location, board=None)