"""Normalization + board classification for Hermes providers.

Re-exports the shared ``_norm`` from ``job_providers`` so every provider
emits the same dict shape downstream code already consumes. Also provides
``_classify_board`` to map a board URL/host to ``{"class", "token"}`` for the
known ATS hosts (Greenhouse, Lever, Ashby, Workday).
"""
from __future__ import annotations

import re
import uuid
from urllib.parse import urlparse


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"&[a-z]+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _norm(source, title, company, location, url, description, tags=None,
          salary=None, posted_at=None, remote=None):
    result = {
        "job_id": str(uuid.uuid4()),
        "source": source,
        "title": (title or "").strip(),
        "company": (company or "").strip() or "Unknown",
        "location": (location or "Remote").strip() or "Remote",
        "url": url or "",
        "description": _strip_html(description)[:1500],
        "tags": [t for t in (tags or []) if t][:12],
        "salary": salary or "",
        "posted_at": posted_at or "",
    }
    if remote is not None:
        result["remote"] = bool(remote)
    return result


UA = {"User-Agent": "Mozilla/5.0 (Tayari/1.0; +https://tayari.app)"}


def _dedupe(jobs: list) -> list:
    seen = set()
    out = []
    for j in jobs:
        key = (j["title"].lower(), j["company"].lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(j)
    return out


# ---------------------------------------------------------------------------
# Board classification
# ---------------------------------------------------------------------------

# Host fragment -> board class. Order matters: longest/most-specific first.
_HOST_RULES: tuple[tuple[str, str], ...] = (
    ("boards-api.greenhouse.io", "greenhouse"),
    ("boards.greenhouse.io", "greenhouse"),
    ("jobs.lever.co", "lever"),
    ("api.lever.co", "lever"),
    ("jobs.ashbyhq.com", "ashby"),
    ("api.ashbyhq.com", "ashby"),
)


def _classify_board(url_or_host: str | None) -> dict | None:
    """Return ``{"class", "token"}`` for a known ATS board, else ``None``.

    ``token`` is the board/path slug when it can be derived (greenhouse/
    lever/ashby). For Workday the tenant host is returned as ``token`` so the
    Workday provider can rebuild the request URL.
    """
    if not url_or_host:
        return None

    host = url_or_host.strip()
    if "://" in host:
        host = urlparse(host).netloc or host
    host = host.lower()
    path = urlparse(url_or_host).path.strip("/") if "://" in (url_or_host or "") else ""

    for fragment, board_class in _HOST_RULES:
        if fragment in host:
            token = _extract_token(board_class, path)
            return {"class": board_class, "token": token}

    # Workday: *.myworkdayjobs.com (tenant host carries the routing info)
    if "myworkdayjobs.com" in host:
        return {"class": "workday", "token": host}

    return None


def _extract_token(board_class: str, path: str) -> str:
    """Pull the board slug out of a known ATS URL path."""
    segments = [s for s in path.split("/") if s]
    if not segments:
        return ""
    if board_class == "greenhouse":
        # /v1/boards/{token}/jobs -> token at index 2
        if "boards" in segments:
            idx = segments.index("boards")
            return segments[idx + 1] if idx + 1 < len(segments) else ""
        return segments[-1]
    # lever/ashby: first path segment is the board slug.
    return segments[0]