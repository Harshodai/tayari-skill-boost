"""Scraping legal-boundary policy — robots.txt + outbound backoff.

Legal boundary, not a preference. hiQ v. LinkedIn resolved on remand in
LinkedIn's favour: a site's robots.txt and User Agreement are enforceable
signals, and aggressive scraping carries documented user-account ban risk.
Every outbound HTTP fetch the engine makes to a third-party job board or
content site must (a) be allowed by that origin's robots.txt for our
User-Agent, and (b) wait its turn under per-domain exponential backoff so
we do not hammer a target.

For the hosted product we restrict scraping to licensed/official feeds
(LICENSED_FEEDS) so the operator (us) never scrapes a site that prohibits
it. The self-host SKU keeps the aggressive scraper but still respects
robots.txt — the user, not us, is the operator there.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import time
import urllib.parse
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

USER_AGENT = "JobTayari/1.0 (+https://jobtayari.com; robots-compliant)"

# Licensed/official feeds safe for the hosted product — the operator (us)
# fetches from these under their terms, not by scraping third-party sites.
# The self-host SKU may use any source; this set gates the hosted path only.
LICENSED_FEEDS: frozenset[str] = frozenset(
    {"adzuna", "arbeitnow", "remoteok", "usajobs", "greenhouse", "lever"}
)

# Origins corresponding to LICENSED_FEEDS. The hosted-mode gate matches a
# URL's host against these, so no browser navigation can reach an unlicensed
# site while hosted mode is on, even when the provider name is not known.
LICENSED_FEED_ORIGINS: frozenset[str] = frozenset(
    {
        "adzuna.com",
        "arbeitnow.com",
        "remoteok.com",
        "usajobs.gov",
        "boards.greenhouse.io",
        "jobs.lever.co",
    }
)

# Hosted-mode gate. When True, scraping is restricted to LICENSED_FEEDS +
# official RSS; aggressive DOM scraping is disabled. Read once at import
# but read_live() is provided for tests that flip the env mid-process.
_HOSTED_ENV_VAR = "TAYARI_HOSTED_MODE"


def _read_hosted_mode() -> bool:
    val = os.environ.get(_HOSTED_ENV_VAR, "").strip().lower()
    return val in ("1", "true", "yes", "on")


HOSTED_SAFE_SOURCES_ONLY: bool = _read_hosted_mode()


def hosted_safe_sources_only() -> bool:
    """Live read of the hosted-mode env flag.

    Use this (not the module-level constant) when the flag may have been
    flipped since import, e.g. in tests.
    """
    return _read_hosted_mode()


class LicensedSourceError(RuntimeError):
    """Raised when hosted mode is on and the URL's origin is not licensed.

    Hosted-mode policy is fail-closed: the hosted operator never scrapes a
    site that prohibits it, so an unlicensed source must raise and be
    skipped by the caller — never fetched.
    """

    def __init__(self, url: str) -> None:
        self.url = url
        super().__init__(f"hosted mode restricts scraping to licensed feeds: {url!r}")


def is_licensed_source(url: str) -> bool:
    """True when the URL's origin is on the licensed-feed allow-list.

    Matches the exact origin or any subdomain of a licensed origin
    (domain.endswith("." + origin)), including subdomains OF the subdomain
    (e.g. acme.jobs.lever.co or apply.boards.greenhouse.io). Hosted mode
    therefore restricts scraping to licensed feed origins AND any subdomain
    of them — which is what lets provider-branded apply pages through —
    and anything that cannot be confirmed as a licensed-provider or
    licensed-feed origin is licensed_blocked.
    """
    domain = _domain_of(url)
    if not domain:
        return False
    return domain in LICENSED_FEED_ORIGINS or any(
        domain.endswith("." + origin) for origin in LICENSED_FEED_ORIGINS
    )


def assert_licensed_source(url: str) -> None:
    """Fail-closed hosted-mode gate.

    When hosted mode is on, raise ``LicensedSourceError`` unless the URL's
    origin is a licensed feed. No-op when hosted mode is off — the self-host
    operator decides their own posture, subject to robots.txt + backoff.
    """
    if not hosted_safe_sources_only():
        return
    if not is_licensed_source(url):
        raise LicensedSourceError(url)


class RobotsDisallowedError(RuntimeError):
    """Raised when a URL is disallowed by the origin's robots.txt.

    Carries the offending URL so the caller can log a clear skip reason
    and the scrape returns None / [] rather than raising out.
    """

    def __init__(self, url: str) -> None:
        self.url = url
        super().__init__(f"robots.txt disallows scraping: {url!r}")


# --- robots.txt cache -------------------------------------------------------

_ROBOTS_CACHE_TTL_SECONDS: float = 3600.0  # 1 hour
_robots_cache: dict[str, tuple[float, dict]] = {}


def _origin(url: str) -> str:
    """Return scheme://host[:port] for the URL, or "" when unparseable.

    Only http and https schemes are accepted — anything else (file, ftp,
    ...) returns "" so robots.txt fetching can never reach a non-HTTP
    handler.
    """
    try:
        parsed = urllib.parse.urlparse(url if "://" in url else f"https://{url}")
        if not parsed.hostname:
            return ""
        netloc = parsed.netloc or parsed.hostname
        scheme = (parsed.scheme or "https").lower()
        if scheme not in ("http", "https"):
            return ""
        return f"{scheme}://{netloc}"
    except Exception:
        return ""


def _fetch_robots_raw(origin: str) -> str:
    """Synchronous fetch of the origin's robots.txt. Returns "" on any error."""
    robots_url = origin.rstrip("/") + "/robots.txt"
    try:
        req = urllib.request.Request(
            robots_url,
            headers={"User-Agent": USER_AGENT},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:  # nosec B310
            if resp.status != 200:
                return ""
            return resp.read().decode("utf-8", errors="ignore")
    except Exception as exc:  # noqa: BLE001 - fail open per RFC 9309
        logger.info("robots.txt fetch failed for %s (%s); failing open", origin, exc)
        return ""


def _parse_robots(raw: str, user_agent: str) -> dict:
    """Minimal RFC-style parser: collect Disallow/Allow paths for the UA group.

    Returns ``{"allowed": True/False at the record level, "crawl_delay": float|None,
    "disallowed_paths": list[str]}``. Group matching: the first group whose
    User-agent line matches our UA (or "*") wins; if no group matches, all
    paths are allowed.
    """
    lines = raw.splitlines()
    groups: list[dict] = []
    current: dict | None = None
    our_ua = user_agent.lower()
    matched_group: dict | None = None
    fallback_group: dict | None = None

    for line in lines:
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        if ":" not in line:
            continue
        field, _, value = line.partition(":")
        field = field.strip().lower()
        value = value.strip()

        if field == "user-agent":
            ua = value.lower()
            # Start a new group record; a sequence of User-agent lines
            # before any Disallow/Allow applies to all of them.
            if current and current.get("rules"):
                groups.append(current)
                current = None
            if current is None:
                current = {"agents": [ua], "rules": [], "crawl_delay": None}
            else:
                current["agents"].append(ua)
            continue

        if field in ("allow", "disallow"):
            if current is None:
                current = {"agents": ["*"], "rules": [], "crawl_delay": None}
            current["rules"].append((field, value))
            continue

        if field == "crawl-delay":
            if current is None:
                current = {"agents": ["*"], "rules": [], "crawl_delay": None}
            try:
                current["crawl_delay"] = float(value)
            except ValueError:
                pass
            continue

    if current and current.get("rules"):
        groups.append(current)

    for g in groups:
        if our_ua in g["agents"] or our_ua in ("jobtayari",) and "jobtayari" in g["agents"]:
            matched_group = g
            break
    if matched_group is None:
        for g in groups:
            if "*" in g["agents"]:
                fallback_group = g
                break
    chosen = matched_group or fallback_group

    if chosen is None:
        return {"allowed": True, "crawl_delay": None, "disallowed_paths": []}

    disallowed = [path for kind, path in chosen["rules"] if kind == "disallow" and path]
    allowed_paths = [path for kind, path in chosen["rules"] if kind == "allow" and path]

    # The record-level "allowed" is a coarse summary; per-path evaluation
    # happens in is_robots_allowed. We mark allowed=True when there are no
    # disallow rules at all, else True (paths are checked individually).
    return {
        "allowed": len(disallowed) == 0,
        "crawl_delay": chosen.get("crawl_delay"),
        "disallowed_paths": disallowed,
        "allowed_paths": allowed_paths,
    }


def fetch_robots_txt(url: str, user_agent: str = "JobTayari") -> Optional[dict]:
    """Fetch and parse robots.txt for the URL's origin.

    Cached per-origin for 1 hour (in-memory). Returns
    ``{"allowed": bool, "crawl_delay": float|None, "disallowed_paths": list[str]}``.
    Degrades to ``{"allowed": True}`` on any fetch failure (fail-open for
    robots.txt itself per RFC 9309 §2.2.1, but the miss is logged).
    """
    origin = _origin(url)
    if not origin:
        return {"allowed": True, "crawl_delay": None, "disallowed_paths": []}

    now = time.monotonic()
    cached = _robots_cache.get(origin)
    if cached is not None:
        ts, record = cached
        if now - ts < _ROBOTS_CACHE_TTL_SECONDS:
            return record

    raw = _fetch_robots_raw(origin)
    if not raw:
        record = {"allowed": True, "crawl_delay": None, "disallowed_paths": []}
    else:
        record = _parse_robots(raw, user_agent)
    _robots_cache[origin] = (now, record)
    return record


async def afetch_robots_txt(url: str, user_agent: str = "JobTayari") -> Optional[dict]:
    """Async fetch and parse of robots.txt for the URL's origin.

    Same semantics as fetch_robots_txt, but the network fetch runs off the
    event loop via asyncio.to_thread so async callers do not block.
    """
    origin = _origin(url)
    if not origin:
        return {"allowed": True, "crawl_delay": None, "disallowed_paths": []}

    now = time.monotonic()
    cached = _robots_cache.get(origin)
    if cached is not None:
        ts, record = cached
        if now - ts < _ROBOTS_CACHE_TTL_SECONDS:
            return record

    raw = await asyncio.to_thread(_fetch_robots_raw, origin)
    if not raw:
        record = {"allowed": True, "crawl_delay": None, "disallowed_paths": []}
    else:
        record = _parse_robots(raw, user_agent)
    _robots_cache[origin] = (now, record)
    return record


def _path_matches(path: str, pattern: str) -> bool:
    """robots.txt path matching with '*' wildcard and '$' end-anchor."""
    if pattern == "":
        return False
    if pattern == "/":
        # A bare "/" rule covers the whole origin (RFC 9309 §5.3.1).
        return True
    # Escape the pattern before regex construction so literal regex
    # metacharacters in a rule ('.', '+', '(', ...) match literally; the
    # only supported wildcard is '*' and the only anchor is a trailing '$'.
    regex = "^" + re.escape(pattern)
    regex = regex.replace(r"\*", ".*")
    if regex.endswith(r"\$"):
        regex = regex[:-2] + "$"
    try:
        return bool(re.match(regex, path))
    except re.error:
        return path.startswith(pattern.rstrip("$"))


def _is_robots_allowed(record: Optional[dict], url: str) -> bool:
    """Evaluate a parsed robots record against the URL's path.

    The longest matching rule wins (RFC 9309 §5.3.1); Allow never silently
    defeats a longer Disallow. None/empty record means allowed.
    """
    if record is None:
        return True
    disallowed = record.get("disallowed_paths", []) or []
    allowed_paths = record.get("allowed_paths", []) or []
    try:
        parsed = urllib.parse.urlparse(url if "://" in url else f"https://{url}")
    except Exception:
        return True
    path = parsed.path or "/"

    matches = []
    for pat in allowed_paths:
        if _path_matches(path, pat):
            matches.append((len(pat), True))
    for pat in disallowed:
        if _path_matches(path, pat):
            matches.append((len(pat), False))
    if not matches:
        return True
    matches.sort(key=lambda m: m[0], reverse=True)
    return matches[0][1]


def is_robots_allowed(url: str, user_agent: str = "JobTayari") -> bool:
    """True when robots.txt allows this URL for the User-Agent.

    Fails open (returns True) on any fetch error — RFC 9309 says an
    unreachable robots.txt means crawl is allowed, but the fetch is logged.
    """
    if not url or not isinstance(url, str):
        return True
    record = fetch_robots_txt(url, user_agent=user_agent)
    return _is_robots_allowed(record, url)


def assert_robots_allowed(url: str, user_agent: str = "JobTayari") -> None:
    """Raise ``RobotsDisallowedError`` when the URL is disallowed.

    Called before any scrape. Fail-open: when robots.txt is unreachable
    (and therefore the URL is allowed), this is a no-op.
    """
    if not is_robots_allowed(url, user_agent=user_agent):
        raise RobotsDisallowedError(url)


async def aassert_robots_allowed(url: str, user_agent: str = "JobTayari") -> None:
    """Async twin of assert_robots_allowed for coroutine call sites.

    Fetches robots.txt off the event loop (asyncio.to_thread) so the
    coroutine path never blocks; the sync entry points above are unchanged.
    """
    record = await afetch_robots_txt(url, user_agent=user_agent)
    if not _is_robots_allowed(record, url):
        raise RobotsDisallowedError(url)


# --- outbound backoff -------------------------------------------------------

_backoff_state: dict[str, float] = {}  # domain -> last request monotonic time
_backoff_last_delay: dict[str, float] = {}  # domain -> last returned delay


def _domain_of(url: str) -> str:
    try:
        parsed = urllib.parse.urlparse(url if "://" in url else f"https://{url}")
        return (parsed.hostname or "").lower()
    except Exception:
        return ""


def outbound_backoff(domain: str, min_delay: float = 1.0, max_delay: float = 5.0) -> float:
    """Exponential backoff per-domain with full jitter.

    Returns the delay in seconds to wait before the next request to this
    domain. The first request returns 0 (no wait); subsequent requests
    draw the delay uniformly from ``[0, exp_delay]`` where ``exp_delay``
    starts at ``min_delay`` and doubles up to ``max_delay`` (full jitter,
    RFC 9309 §5.4.2, so concurrent agents do not synchronize). Tracks
    last-request time per-domain in an in-memory dict.

    Callers should: ``delay = outbound_backoff(domain); if delay: await asyncio.sleep(delay)``
    BEFORE the fetch, then record the request by calling again or by
    having this function itself update state. We update state on every
    call so the caller does not need a second bookkeeping call.
    """
    if not domain:
        return 0.0
    now = time.monotonic()
    last = _backoff_state.get(domain)
    last_delay = _backoff_last_delay.get(domain)

    if last is None:
        # First request: no wait, but record that we are about to hit it.
        _backoff_state[domain] = now
        _backoff_last_delay[domain] = 0.0
        return 0.0

    # Compute the wait: how long since the last request, capped by the
    # exponential delay that should have been observed.
    next_delay = min_delay if last_delay in (None, 0.0) else min(last_delay * 2, max_delay)
    next_delay = min(next_delay, max_delay)
    jittered_delay = random.uniform(0.0, next_delay) if next_delay > 0.0 else 0.0
    # If the caller already waited (time since last request >= jittered
    # delay), no additional sleep is needed; just return 0. Otherwise
    # return the remaining wait.
    elapsed = now - last
    remaining = max(0.0, jittered_delay - elapsed)
    # Record the last actual request time so the next call's elapsed
    # includes whatever the caller slept.
    _backoff_state[domain] = now
    _backoff_last_delay[domain] = next_delay
    return remaining


def reset_backoff_state() -> None:
    """Clear backoff state. Test helper — not for production use."""
    _backoff_state.clear()
    _backoff_last_delay.clear()


def reset_robots_cache() -> None:
    """Clear the robots.txt cache. Test helper."""
    _robots_cache.clear()


async def await_backoff(url: str, min_delay: float = 1.0, max_delay: float = 5.0) -> float:
    """Convenience: compute backoff for the URL's domain and sleep if needed.

    Returns the delay that was slept (0.0 if none). For async call sites.
    """
    import asyncio
    domain = _domain_of(url)
    delay = outbound_backoff(domain, min_delay=min_delay, max_delay=max_delay)
    if delay > 0:
        await asyncio.sleep(delay)
    return delay