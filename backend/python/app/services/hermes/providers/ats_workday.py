"""Workday ATS provider (keyless).

Workday career sites expose a JSON endpoint at
``POST https://{tenant_host}/wday/cxs/{tenant}/{site}/jobs`` with body
``{appliedFacets:{}, limit:20, offset:0, searchText:query}``. The tenant
host (e.g. ``acme.wd1.myworkdayjobs.com``) must be supplied via a board
``token``/``url`` because it is tenant-specific. Without a board the shim
returns [] (documented) - there is no sensible default tenant host.
"""
from __future__ import annotations

import logging
from urllib.parse import urlparse

import httpx

from app.services.hermes.normalize import _norm
from app.services.job_providers import UA

logger = logging.getLogger(__name__)

BOARD_CLASS = "workday"
TIER = "ats"
REQUIRES_KEY = False

PAGE_LIMIT = 20
MAX_OFFSET = 200  # cap pagination to avoid hammering a tenant


class WorkdayProvider:
    name = "workday"
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
        target = _resolve_target(board)
        if not target:
            return []  # no tenant host => nothing to query
        tenant_host, tenant, site = target
        results: list[dict] = []
        offset = 0
        while offset <= MAX_OFFSET:
            batch, total = await self._fetch_page(
                client, tenant_host, tenant, site, query, offset,
            )
            results.extend(batch)
            if offset + PAGE_LIMIT >= total or not batch:
                break
            offset += PAGE_LIMIT
        return results

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        tenant_host: str,
        tenant: str,
        site: str,
        query: str,
        offset: int,
    ) -> tuple[list[dict], int]:
        url = f"https://{tenant_host}/wday/cxs/{tenant}/{site}/jobs"
        body = {
            "appliedFacets": {},
            "limit": PAGE_LIMIT,
            "offset": offset,
            "searchText": query or "",
        }
        try:
            resp = await client.post(url, json=body, headers=UA, timeout=20)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("workday: '%s' failed (%s)", tenant_host, exc)
            return [], 0

        postings = data.get("jobPostings", []) or []
        total = int(data.get("total", len(postings)) or 0)
        out: list[dict] = []
        for job in postings:
            external_path = job.get("externalPath", "")
            detail_url = f"https://{tenant_host}{external_path}" if external_path else ""
            bullets = job.get("bulletFields", []) or []
            description = " ".join(b.get("body", "") for b in bullets if b.get("body"))
            out.append(_norm(
                source="workday",
                title=job.get("title", ""),
                company=tenant,
                location=job.get("locationsText", ""),
                url=detail_url,
                description=description,
            ))
        return out, total


def _resolve_target(board: dict | None) -> tuple[str, str, str] | None:
    """Derive (tenant_host, tenant, site) from a board dict.

    The board ``token``/``url`` is expected to be the tenant host such as
    ``acme.wd1.myworkdayjobs.com`` or a full career-site URL.
    """
    if not board:
        return None
    raw = board.get("token") or board.get("url") or ""
    if not raw:
        return None
    host = raw.strip()
    if "://" in host:
        host = urlparse(host).netloc or host
    host = host.lower()
    if "myworkdayjobs.com" not in host:
        return None
    # tenant = first label, site = second label (heuristic).
    labels = host.split(".")[0]
    parts = labels.split("-") if "-" in labels else [labels, "en-US"]
    tenant = parts[0]
    site = parts[1] if len(parts) > 1 else "en-US"
    return host, tenant, site


workday = WorkdayProvider()


async def fetch(client: httpx.AsyncClient, query: str, location: str = "") -> list:
    """Shim: Workday needs a tenant host, so generic queries return []."""
    return []