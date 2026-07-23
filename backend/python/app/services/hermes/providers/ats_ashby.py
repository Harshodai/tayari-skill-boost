"""Ashby ATS provider (keyless).

Ashby exposes a public posting API at
``https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true``.
The ``name`` is case-sensitive. No auth required. When no board name is
supplied the shim iterates a small list of well-known public board names.
"""
from __future__ import annotations

import logging

import httpx

from app.services.hermes.normalize import _norm, UA

logger = logging.getLogger(__name__)

BOARD_CLASS = "ashby"
TIER = "ats"
REQUIRES_KEY = False
BASE_URL = "https://api.ashbyhq.com/posting-api/job-board"

# Well-known public Ashby board names (case-sensitive).
DEFAULT_TOKENS: tuple[str, ...] = ("ashby", "notion")


class AshbyProvider:
    name = "ashby"
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
        names = _resolve_names(board)
        if not names:
            return []
        results: list[dict] = []
        for name in names:
            results.extend(await self._fetch_board(client, name, query))
        return results

    async def _fetch_board(
        self, client: httpx.AsyncClient, name: str, query: str,
    ) -> list[dict]:
        try:
            resp = await client.get(
                f"{BASE_URL}/{name}",
                params={"includeCompensation": "true"},
                headers=UA,
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("ashby: board '%s' failed (%s)", name, exc)
            return []

        q = (query or "").lower()
        out: list[dict] = []
        for job in data.get("postedJobs", []) or []:
            title = job.get("title", "")
            if q and not _matches(title, q):
                continue
            comp = job.get("compensation") or {}
            salary = _format_salary(comp)
            out.append(_norm(
                source="ashby",
                title=title,
                company=name,
                location=job.get("locationText", ""),
                url=job.get("externalUrl", ""),
                description=job.get("descriptionHtml", ""),
                salary=salary,
            ))
        return out


def _format_salary(comp: dict) -> str:
    tiers = comp.get("compensationTierSummary") or comp.get("tiers") or []
    if not tiers:
        return ""
    try:
        first = tiers[0] if isinstance(tiers, list) else tiers
        if isinstance(first, dict):
            lo = first.get("min") or first.get("minimum")
            hi = first.get("max") or first.get("maximum")
            if lo and hi:
                return f"{lo} - {hi}"
    except Exception:  # noqa: BLE001
        pass
    return ""


def _resolve_names(board: dict | None) -> list[str]:
    if board and board.get("token"):
        return [board["token"]]
    return list(DEFAULT_TOKENS)


def _matches(title: str, query_lower: str) -> bool:
    haystack = (title or "").lower()
    return all(part in haystack for part in query_lower.split()[:3])


ashby = AshbyProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    return await ashby.fetch(client, query, location, board=None)