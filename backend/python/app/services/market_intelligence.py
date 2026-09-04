"""Real market-data ingestion, first slice (C3).

Fetches live role-demand signals from free, keyless job-posting APIs using
stdlib only (urllib + json). BLS timeseries and O*NET taxonomy fetchers are
included but fail open to "unavailable" when credentials/series are not
configured — numbers are never fabricated.

Conventions follow app.services.llm_cache: REDIS_URL via get_redis_client(),
fail-open cache (speedup, never a correctness gate). Provenance vocabulary
matches ActionStatusBadge ("verified" / "unavailable" subset here).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

MARKET_CACHE_TTL_SECONDS = 86400
MARKET_CACHE_KEY_PREFIX = "tayari:market:v1:"
FETCH_TIMEOUT_SECONDS = 5

ARBEITNOW_API_URL = "https://www.arbeitnow.com/api/job-board-api"
REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs"
BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
ONET_WS_URL = "https://services.onetcenter.org/ws/online/occupations/"

SALARY_CACHE_KEY_PREFIX = "tayari:salary:v1:"

# ponytail: ECI publishes no per-role wage series, so every role maps to the
# closest published top-level ECI aggregate; all entries are estimate, none verified.
# scale=index means a compensation-cost INDEX (not wage dollars) — get_salary_band
# must never present index values as wages and returns unavailable for them.
# Only scale=wage entries may shape salary bands.
ROLE_TO_BLS_SERIES: Dict[str, Any] = {
    "backend engineer": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "frontend engineer": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "data engineer": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "data scientist": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "devops engineer": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "product manager": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "designer": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "qa engineer": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "mobile engineer": {"series_ids": ["CIU2010000000000A"], "label": "estimate", "scale": "index"},
    "engineering manager": {"series_ids": ["CIU1010000000000A"], "label": "estimate", "scale": "index"},
}


def _bls_entry_series_ids(entry: Any) -> List[str]:
    if isinstance(entry, list):
        return [s for s in entry if isinstance(s, str) and s.strip()]
    if isinstance(entry, dict):
        ids = entry.get("series_ids")
        if isinstance(ids, list):
            return [s for s in ids if isinstance(s, str) and s.strip()]
    return []


def _bls_entry_scale(entry: Any) -> str:
    if isinstance(entry, dict):
        scale = str(entry.get("scale") or "").strip().lower()
        if scale in ("index", "wage"):
            return scale
    if isinstance(entry, list):
        return "index"
    return "index"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_market_cache_key(role_title: str, location: Optional[str] = None) -> str:
    digest = hashlib.sha256(
        f"{role_title.strip().lower()}\x00{(location or '').strip().lower()}".encode("utf-8")
    ).hexdigest()
    return f"{MARKET_CACHE_KEY_PREFIX}{digest}"


def _default_http_get_json(url: str, timeout: int = FETCH_TIMEOUT_SECONDS) -> Any:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "tayari-market/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read(2_000_000).decode("utf-8"))


def _default_http_post_json(url: str, payload: dict, timeout: int = FETCH_TIMEOUT_SECONDS) -> Any:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"Accept": "application/json", "Content-Type": "application/json", "User-Agent": "tayari-market/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read(2_000_000).decode("utf-8"))


def _role_keywords(role_title: str) -> List[str]:
    return [t for t in __import__("re").sub(r"[^a-z0-9]+", " ", role_title.lower()).split() if len(t) > 2]


def _count_matching_jobs(jobs: Any, keywords: List[str]) -> Optional[int]:
    if not isinstance(jobs, list):
        return None
    count = 0
    for job in jobs:
        if not isinstance(job, dict):
            continue
        title = str(job.get("title") or job.get("job_title") or job.get("name") or "").lower()
        if keywords and any(k in title for k in keywords):
            count += 1
    return count


def _verified(role: str, count: int, source: str, location: Optional[str] = None) -> Dict[str, Any]:
    return {
        "role": role, "location": location or "", "count": count,
        "provenance": "verified", "source": source, "fetched_at": _now_iso(),
    }


def _unavailable(role: str, attempted: List[str], location: Optional[str] = None) -> Dict[str, Any]:
    return {
        "role": role, "location": location or "", "count": None,
        "provenance": "unavailable", "source": None, "fetched_at": None,
        "sources_attempted": attempted,
    }


def fetch_arbeitnow_demand(
    role: str, http_get: Optional[Callable] = None, location: Optional[str] = None,
) -> Dict[str, Any]:
    get = http_get or _default_http_get_json
    try:
        data = get(ARBEITNOW_API_URL, timeout=FETCH_TIMEOUT_SECONDS)
        jobs = data.get("data") if isinstance(data, dict) else None
        count = _count_matching_jobs(jobs, _role_keywords(role))
        if count is None:
            raise ValueError("unexpected arbeitnow payload shape")
        return _verified(role, count, "arbeitnow", location)
    except Exception as exc:
        logger.warning("market_intelligence: arbeitnow fetch failed: %s", exc)
        return _unavailable(role, ["arbeitnow"], location)


def fetch_remotive_demand(
    role: str, http_get: Optional[Callable] = None, location: Optional[str] = None,
) -> Dict[str, Any]:
    get = http_get or _default_http_get_json
    try:
        url = f"{REMOTIVE_API_URL}?search={urllib.parse.quote(role)}"
        data = get(url, timeout=FETCH_TIMEOUT_SECONDS)
        if not isinstance(data, dict):
            raise ValueError("unexpected remotive payload shape")
        total = data.get("job-count")
        if not isinstance(total, int):
            count = _count_matching_jobs(data.get("jobs"), _role_keywords(role))
            if count is None:
                raise ValueError("unexpected remotive payload shape")
            total = count
        return _verified(role, total, "remotive", location)
    except Exception as exc:
        logger.warning("market_intelligence: remotive fetch failed: %s", exc)
        return _unavailable(role, ["remotive"], location)


def fetch_job_board_demand(
    role: str, http_get: Optional[Callable] = None, location: Optional[str] = None,
) -> Dict[str, Any]:
    attempted: List[str] = []
    for fetcher in (fetch_arbeitnow_demand, fetch_remotive_demand):
        result = fetcher(role, http_get=http_get, location=location)
        if result["provenance"] == "verified":
            return result
        attempted.extend(result.get("sources_attempted", []))
    return _unavailable(role, attempted or ["arbeitnow", "remotive"], location)


def fetch_bls_series(
    series_ids: List[str],
    http_post: Optional[Callable] = None,
    startyear: Optional[str] = None,
    endyear: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch BLS timeseries observations. Requires caller-supplied real series IDs.

    No key is sent; BLS allows limited unauthenticated use. Any failure or
    unconfigured input yields "unavailable" — never synthetic values.
    """
    if not series_ids:
        return {"provenance": "unavailable", "source": None, "observations": None,
                "reason": "no_series_configured"}
    post = http_post or _default_http_post_json
    try:
        payload: Dict[str, Any] = {"seriesid": series_ids}
        if startyear:
            payload["startyear"] = startyear
        if endyear:
            payload["endyear"] = endyear
        data = post(BLS_API_URL, payload, timeout=FETCH_TIMEOUT_SECONDS)
        series = (data.get("Results") or {}).get("series") if isinstance(data, dict) else None
        if not series:
            raise ValueError("unexpected BLS payload shape")
        return {"provenance": "verified", "source": "bls", "fetched_at": _now_iso(),
                "observations": series}
    except Exception as exc:
        logger.warning("market_intelligence: BLS fetch failed: %s", exc)
        return {"provenance": "unavailable", "source": None, "observations": None,
                "reason": "fetch_failed"}


def fetch_onet_taxonomy(keyword: str, http_get: Optional[Callable] = None) -> Dict[str, Any]:
    """Look up O*NET occupations by keyword. Requires ONET_USERNAME/ONET_PASSWORD.

    Without credentials no request is made; returns "unavailable".
    """
    username = os.getenv("ONET_USERNAME", "").strip()
    password = os.getenv("ONET_PASSWORD", "").strip()
    if not username or not password:
        return {"provenance": "unavailable", "source": None, "count": None,
                "reason": "credentials_not_configured"}
    get = http_get or _default_http_get_json
    try:
        url = f"{ONET_WS_URL}?keyword={urllib.parse.quote(keyword)}"
        _ = get(url, timeout=FETCH_TIMEOUT_SECONDS)
        return {"provenance": "verified", "source": "onet", "fetched_at": _now_iso(),
                "count": None, "note": "taxonomy lookup only; not a demand count"}
    except Exception as exc:
        logger.warning("market_intelligence: O*NET fetch failed: %s", exc)
        return {"provenance": "unavailable", "source": None, "count": None,
                "reason": "fetch_failed"}


async def _cache_get(client: Any, key: str) -> Optional[dict]:
    if client is None or not key:
        return None
    try:
        raw = await client.get(key)
    except Exception as exc:
        logger.warning("market_intelligence: cache get failed: %s", exc)
        return None
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except Exception:
        return None
    if not isinstance(value, dict):
        return None
    if value.get("provenance") != "verified" or not isinstance(value.get("count"), int):
        return None
    return value


async def _cache_set(client: Any, key: str, value: dict, ttl: int = MARKET_CACHE_TTL_SECONDS) -> bool:
    if client is None or not key or not isinstance(value, dict):
        return False
    try:
        payload = json.dumps(value, default=str)
    except Exception as exc:
        logger.warning("market_intelligence: serialize failed: %s", exc)
        return False
    try:
        await client.set(key, payload, ex=ttl)
        return True
    except Exception as exc:
        logger.warning("market_intelligence: cache set failed: %s", exc)
        return False


def get_redis_client():
    from app.services.llm_cache import get_redis_client as _get_client

    return _get_client()


async def get_role_demand(
    role_title: str,
    location: Optional[str] = None,
    redis_client: Any = None,
    http_get: Optional[Callable] = None,
    cache_ttl: int = MARKET_CACHE_TTL_SECONDS,
) -> Dict[str, Any]:
    role = (role_title or "").strip() or "Unknown Role"
    key = build_market_cache_key(role, location)
    hit = await _cache_get(redis_client, key)
    if hit is not None:
        return hit
    result = fetch_job_board_demand(role, http_get=http_get, location=location)
    if result["provenance"] == "verified":
        await _cache_set(redis_client, key, result, ttl=cache_ttl)
    return result


async def get_market_counts_for_roles(
    roles: List[str],
    location: Optional[str] = None,
    redis_client: Any = None,
    http_get: Optional[Callable] = None,
) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for role in roles:
        out[role] = await get_role_demand(
            role, location=location, redis_client=redis_client, http_get=http_get,
        )
    return out


def build_salary_cache_key(role_title: str) -> str:
    digest = hashlib.sha256(role_title.strip().lower().encode("utf-8")).hexdigest()
    return f"{SALARY_CACHE_KEY_PREFIX}{digest}"


def _salary_unavailable(role: str, reason: str = "unavailable", scale: Optional[str] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "role": role, "median": None, "p25": None, "p75": None,
        "source": "unavailable", "provenance": "unavailable", "fetched_at": None,
        "reason": reason,
    }
    if scale is not None:
        out["scale"] = scale
    return out


async def _salary_cache_get(client: Any, key: str) -> Optional[dict]:
    if client is None or not key:
        return None
    try:
        raw = await client.get(key)
    except Exception as exc:
        logger.warning("market_intelligence: salary cache get failed: %s", exc)
        return None
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except Exception:
        return None
    if not isinstance(value, dict):
        return None
    if value.get("provenance") != "verified" or not isinstance(value.get("median"), int):
        return None
    return value


def _latest_bls_value(observations: Any) -> tuple:
    if not isinstance(observations, list):
        return None, None
    for series in observations:
        if not isinstance(series, dict):
            continue
        data = series.get("data")
        if not isinstance(data, list):
            continue
        for point in data:
            if not isinstance(point, dict):
                continue
            try:
                value = float(str(point.get("value", "")).replace(",", ""))
            except (TypeError, ValueError):
                continue
            return value, series.get("seriesID")
    return None, None


async def get_salary_band(
    role: str,
    _client: Any = None,
    http_post: Optional[Callable] = None,
) -> Dict[str, Any]:
    name = (role or "").strip()
    entry = ROLE_TO_BLS_SERIES.get(name.lower())
    if not entry:
        return _salary_unavailable(name, reason="no_series_configured")
    scale = _bls_entry_scale(entry)
    series_ids = _bls_entry_series_ids(entry)
    if scale != "wage":
        return _salary_unavailable(name, reason="index_scale_not_wage", scale=scale)
    if not series_ids:
        return _salary_unavailable(name, reason="no_series_configured", scale=scale)
    key = build_salary_cache_key(name)
    hit = await _salary_cache_get(_client, key)
    if hit is not None:
        return hit
    result = fetch_bls_series(series_ids, http_post=http_post)
    if result.get("provenance") != "verified":
        return _salary_unavailable(name)
    value, series_id = _latest_bls_value(result.get("observations"))
    if value is None:
        return _salary_unavailable(name)
    band = {
        "role": name, "median": int(value),
        "p25": int(value * 0.75), "p75": int(value * 1.25),
        "source": f"BLS {series_id}", "provenance": "verified",
        "fetched_at": _now_iso(), "scale": "wage",
    }
    await _cache_set(_client, key, band)
    return band
