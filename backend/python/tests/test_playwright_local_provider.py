"""Playwright local provider cleanup tests (no real Playwright required).

Stubs ``async_playwright`` with fakes that record ``browser.close()`` so the
guaranteed-cleanup ``finally`` in ``fetch()`` is exercised without Playwright
installed (CI-safe).
"""
from __future__ import annotations

import asyncio
import importlib
from typing import Any

pl = importlib.import_module("app.services.hermes.providers.playwright_local")
from app.services.hermes.providers.playwright_local import PlaywrightLocalProvider


class _FakePage:
    def __init__(self, fail_on_evaluate: bool):
        self._fail = fail_on_evaluate

    async def goto(self, url: str, wait_until: str = None, timeout: int = None) -> None:
        return None

    async def wait_for_timeout(self, ms: int) -> None:
        return None

    async def title(self) -> str:
        return "Fake Job Board"

    async def evaluate(self, _script: str) -> str:
        if self._fail:
            raise RuntimeError("evaluate exploded")
        return "raw body text"


class _FakeContext:
    def __init__(self, fail_on_evaluate: bool):
        self._fail = fail_on_evaluate

    async def new_page(self) -> _FakePage:
        return _FakePage(self._fail)


class _FakeBrowser:
    def __init__(self, fail_on_evaluate: bool):
        self.closed = False
        self._fail = fail_on_evaluate

    async def new_context(self, **kwargs: Any) -> _FakeContext:
        return _FakeContext(self._fail)

    async def close(self) -> None:
        self.closed = True


class _FakePlaywright:
    def __init__(self, fail_on_evaluate: bool):
        self.browser = _FakeBrowser(fail_on_evaluate)

    @property
    def chromium(self) -> "_FakePlaywright":
        return self

    async def launch(self, headless: bool = True, args=None) -> _FakeBrowser:
        return self.browser

    async def __aenter__(self) -> "_FakePlaywright":
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False


class _FakeClient:
    """Stand-in for httpx.AsyncClient; fetch() never uses it."""


def _stub_playwright(monkeypatch, fail_on_evaluate: bool) -> _FakeBrowser:
    fake = _FakePlaywright(fail_on_evaluate)
    monkeypatch.setattr(pl, "_PLAYWRIGHT_AVAILABLE", True)
    monkeypatch.setattr(pl, "async_playwright", lambda: fake)
    return fake.browser


def test_fetch_closes_browser_when_scrape_raises(monkeypatch):
    browser = _stub_playwright(monkeypatch, fail_on_evaluate=True)

    result = asyncio.run(PlaywrightLocalProvider().fetch(
        client=_FakeClient(),
        query="engineer",
        location="remote",
        board={"url": "https://example.com/jobs"},
    ))

    assert result == []
    assert browser.closed is True


def test_fetch_closes_browser_and_returns_result_on_success(monkeypatch):
    browser = _stub_playwright(monkeypatch, fail_on_evaluate=False)

    result = asyncio.run(PlaywrightLocalProvider().fetch(
        client=_FakeClient(),
        query="engineer",
        location="remote",
        board={"url": "https://example.com/jobs", "company": "Acme"},
    ))

    assert browser.closed is True
    assert len(result) == 1
    assert result[0]["title"] == "Fake Job Board"
    assert result[0]["description"] == "raw body text"
