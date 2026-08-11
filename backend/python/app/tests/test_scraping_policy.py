"""Tests for the scraping legal-boundary policy (robots.txt + backoff + hosted gate).

Covers: (a) robots.txt deny blocks a URL and allow permits it, with a
fail-open documented default when robots.txt is unreachable; (b) caching of
robots.txt per origin; (c) per-domain exponential backoff with jitter
(sequencing asserted via patched sleep); (d) TAYARI_HOSTED_MODE=true
fail-closed licensed-feed gate, including the BrowserOperator.navigate
wiring (the agent's apply/navigate path never reaches an unlicensed site).
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.services import scraping_policy as sp
from app.services.scraping_policy import (
    LicensedSourceError,
    RobotsDisallowedError,
    assert_licensed_source,
    assert_robots_allowed,
    hosted_safe_sources_only,
    is_licensed_source,
    is_robots_allowed,
    outbound_backoff,
)


@pytest.fixture(autouse=True)
def _clean_policy_state():
    """Isolate the module-level robots cache and backoff state per test."""
    sp.reset_robots_cache()
    sp.reset_backoff_state()
    yield
    sp.reset_robots_cache()
    sp.reset_backoff_state()


# --- robots.txt -------------------------------------------------------------

def test_robots_deny_blocks_site(monkeypatch) -> None:
    monkeypatch.setattr(
        sp, "_fetch_robots_raw", lambda origin: "User-agent: *\nDisallow: /\n"
    )
    assert is_robots_allowed("https://deny.example.com/jobs") is False
    with pytest.raises(RobotsDisallowedError):
        assert_robots_allowed("https://deny.example.com/jobs")


def test_robots_allow_permits_path(monkeypatch) -> None:
    monkeypatch.setattr(
        sp,
        "_fetch_robots_raw",
        lambda origin: "User-agent: *\nDisallow: /private\nAllow: /\n",
    )
    assert is_robots_allowed("https://allow.example.com/jobs") is True
    assert is_robots_allowed("https://allow.example.com/private/dir") is False


def test_robots_ua_specific_group_wins(monkeypatch) -> None:
    raw = "User-agent: JobTayari\nDisallow: /\nUser-agent: *\nAllow: /\n"
    monkeypatch.setattr(sp, "_fetch_robots_raw", lambda origin: raw)
    assert is_robots_allowed("https://ua.example.com/jobs") is False


def test_robots_unreachable_fails_open_documented_default(monkeypatch) -> None:
    # Documented default: an unreachable robots.txt means crawl is allowed
    # (RFC 9309 §2.2.1) but the miss is logged.
    monkeypatch.setattr(sp, "_fetch_robots_raw", lambda origin: "")
    assert is_robots_allowed("https://down.example.com/jobs") is True


def test_robots_cached_per_origin(monkeypatch) -> None:
    calls = []
    def fake_fetch(origin: str) -> str:
        calls.append(origin)
        return "User-agent: *\nDisallow: /\n"
    monkeypatch.setattr(sp, "_fetch_robots_raw", fake_fetch)
    sp.fetch_robots_txt("https://cache.example.com/jobs")
    sp.fetch_robots_txt("https://cache.example.com/other")
    assert len(calls) == 1


# --- backoff ----------------------------------------------------------------

def test_backoff_sequencing_exponential_capped() -> None:
    # Pin monotonic time (no elapsed wait) and jitter to the high bound so
    # the returned delays are exactly the exponential sequence.
    with patch.object(sp.time, "monotonic", return_value=1234.5), \
         patch.object(sp.random, "uniform", side_effect=lambda lo, hi: hi):
        assert outbound_backoff("jobs.example.com") == 0.0
        assert outbound_backoff("jobs.example.com") == 1.0
        assert outbound_backoff("jobs.example.com") == 2.0
        assert outbound_backoff("jobs.example.com") == 4.0
        assert outbound_backoff("jobs.example.com") == 5.0
        assert outbound_backoff("jobs.example.com") == 5.0


def test_backoff_jitter_low_bound_returns_zero() -> None:
    with patch.object(sp.time, "monotonic", return_value=1234.5), \
         patch.object(sp.random, "uniform", return_value=0.0):
        assert outbound_backoff("jitter.example.com") == 0.0
        assert outbound_backoff("jitter.example.com") == 0.0


@pytest.mark.asyncio
async def test_await_backoff_sleeps_returned_delay() -> None:
    with patch.object(sp.time, "monotonic", return_value=1234.5), \
         patch.object(sp.random, "uniform", side_effect=lambda lo, hi: hi), \
         patch("asyncio.sleep", new=AsyncMock()) as sleep_mock:
        assert await sp.await_backoff("https://sleep.example.com/jobs") == 0.0
        assert await sp.await_backoff("https://sleep.example.com/jobs") == 1.0
        assert sleep_mock.await_count == 1
        sleep_mock.assert_awaited_once_with(1.0)


# --- hosted-mode gate -------------------------------------------------------

def test_hosted_mode_env_toggle(monkeypatch) -> None:
    monkeypatch.delenv("TAYARI_HOSTED_MODE", raising=False)
    assert hosted_safe_sources_only() is False
    monkeypatch.setenv("TAYARI_HOSTED_MODE", "true")
    assert hosted_safe_sources_only() is True
    monkeypatch.setenv("TAYARI_HOSTED_MODE", "1")
    assert hosted_safe_sources_only() is True
    monkeypatch.setenv("TAYARI_HOSTED_MODE", "off")
    assert hosted_safe_sources_only() is False


def test_hosted_mode_blocks_unlicensed_source(monkeypatch) -> None:
    monkeypatch.setenv("TAYARI_HOSTED_MODE", "true")
    assert is_licensed_source("https://www.linkedin.com/jobs/view/123") is False
    with pytest.raises(LicensedSourceError):
        assert_licensed_source("https://www.linkedin.com/jobs/view/123")
    with pytest.raises(LicensedSourceError):
        assert_licensed_source("https://randomboards.example.com/jobs")


def test_hosted_mode_licensed_feeds_pass(monkeypatch) -> None:
    monkeypatch.setenv("TAYARI_HOSTED_MODE", "true")
    for origin in sp.LICENSED_FEED_ORIGINS:
        assert is_licensed_source(f"https://{origin}/x") is True
        assert_licensed_source(f"https://{origin}/x")
    assert_licensed_source("https://jobs.lever.co/acme/abc")
    assert_licensed_source("https://boards.greenhouse.io/acme/123")


def test_hosted_mode_off_allows_any_source(monkeypatch) -> None:
    monkeypatch.delenv("TAYARI_HOSTED_MODE", raising=False)
    assert_licensed_source("https://any.example.com/jobs")


# --- BrowserOperator wiring -------------------------------------------------

@pytest.mark.asyncio
async def test_navigate_blocks_unlicensed_in_hosted_mode(monkeypatch) -> None:
    monkeypatch.setenv("TAYARI_HOSTED_MODE", "true")
    from app.agent.browser_operator import BrowserOperator
    op = BrowserOperator()
    op.initialize = AsyncMock(side_effect=AssertionError("must not initialize"))
    res = await op.navigate("https://www.linkedin.com/jobs/view/123")
    assert res["success"] is False
    assert res["licensed_blocked"] is True
    op.initialize.assert_not_awaited()


@pytest.mark.asyncio
async def test_navigate_robots_blocked_returns_skip(monkeypatch) -> None:
    monkeypatch.setattr(
        sp, "_fetch_robots_raw", lambda origin: "User-agent: *\nDisallow: /\n"
    )
    from app.agent.browser_operator import BrowserOperator
    op = BrowserOperator()
    op.initialize = AsyncMock(side_effect=AssertionError("must not initialize"))
    res = await op.navigate("https://robotsblock.example.com/jobs")
    assert res["success"] is False
    assert res["robots_blocked"] is True
    op.initialize.assert_not_awaited()
