"""Canonical job identity and freshness helpers.

Job providers frequently emit the same posting with tracking parameters,
fragments, or small display-name differences. The identity is deterministic and
contains no candidate data, so it can be used as a deduplication key and stored
alongside an application package.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


_TRACKING_PARAMS = frozenset(
    {
        "_hsenc",
        "_hsmi",
        "campaign",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "source",
        "trk",
        "utm_campaign",
        "utm_content",
        "utm_medium",
        "utm_source",
        "utm_term",
    }
)
_WHITESPACE = re.compile(r"\s+")


def _clean(value: object | None) -> str:
    return _WHITESPACE.sub(" ", str(value or "").strip().lower())


def normalize_job_url(url: str | None) -> str:
    """Normalize a public job URL without resolving or fetching it."""
    raw = str(url or "").strip()
    if not raw:
        return ""
    parts = urlsplit(raw)
    if not parts.scheme or not parts.netloc:
        return raw
    hostname = (parts.hostname or "").lower()
    port = parts.port
    netloc = hostname
    if port and not ((parts.scheme.lower() == "https" and port == 443) or (parts.scheme.lower() == "http" and port == 80)):
        netloc = f"{hostname}:{port}"
    query = urlencode(
        sorted(
            (key, value)
            for key, value in parse_qsl(parts.query, keep_blank_values=True)
            if key.lower() not in _TRACKING_PARAMS and not key.lower().startswith("utm_")
        )
    )
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), netloc, path, query, ""))


def job_identity(job: dict) -> dict:
    """Return a deterministic identity record with source and observed time."""
    normalized_url = normalize_job_url(job.get("url"))
    provider = _clean(job.get("provider") or job.get("source") or "unknown")
    title = _clean(job.get("title"))
    company = _clean(job.get("company"))
    location = _clean(job.get("location"))
    canonical_basis = "|".join((provider, normalized_url, title, company, location))
    digest = hashlib.sha256(canonical_basis.encode("utf-8")).hexdigest()
    return {
        "key": digest,
        "provider": provider,
        "source_url": normalized_url or None,
        "title": title,
        "company": company,
        "location": location,
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }


def attach_job_identity(job: dict) -> dict:
    """Return a copy with the identity record attached and no private fields."""
    result = dict(job)
    result["job_identity"] = job_identity(result)
    return result
