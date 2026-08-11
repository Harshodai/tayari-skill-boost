"""WS-06 — real per-run browser isolation and a kill switch.

There is no "sandbox" here and we no longer pretend there is one. A run gets a
``BrowserSession`` from a provider selected by the ``BROWSER_PROVIDER`` env var:

* ``local``       — Playwright in this process (development default).
* ``browserbase`` — one remote Browserbase session per run, with a real
                    session-terminate API behind the kill switch.

The registry below is what makes cancellation provable: the agent loop polls
``is_cancelled(run_id)`` between steps, and ``cancel_run`` additionally calls
the provider's terminate API so the remote browser dies even if the loop is
wedged.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Dict, Optional

logger = logging.getLogger(__name__)

BROWSERBASE_API = "https://api.browserbase.com/v1"


class BrowserSessionError(RuntimeError):
    """Raised when a session could not be created or terminated."""


@dataclass
class BrowserSession:
    """A single isolated browser for a single run."""

    run_id: str
    provider: str
    session_id: Optional[str] = None
    cdp_url: Optional[str] = None
    live_view_url: Optional[str] = None
    cancelled: bool = False
    owner_id: Optional[str] = None
    meta: Dict[str, str] = field(default_factory=dict)


class BrowserProvider:
    name = "base"

    async def create(self, run_id: str) -> BrowserSession:  # pragma: no cover - interface
        raise NotImplementedError

    async def terminate(self, session: BrowserSession) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class LocalPlaywrightProvider(BrowserProvider):
    """Dev provider: browser-use launches its own local Playwright browser.

    No CDP URL is handed back, so the agent falls back to its default local
    browser. Termination is cooperative — the agent loop sees the cancel flag
    and stops, which closes the local browser with it.
    """

    name = "local"

    async def create(self, run_id: str) -> BrowserSession:
        return BrowserSession(run_id=run_id, provider=self.name)

    async def terminate(self, session: BrowserSession) -> None:
        session.cancelled = True


class BrowserbaseProvider(BrowserProvider):
    """Production provider: one remote Browserbase session per run."""

    name = "browserbase"

    def __init__(self) -> None:
        self.api_key = os.getenv("BROWSERBASE_API_KEY", "").strip()
        self.project_id = os.getenv("BROWSERBASE_PROJECT_ID", "").strip()

    def _headers(self) -> Dict[str, str]:
        if not self.api_key or not self.project_id:
            raise BrowserSessionError(
                "BROWSER_PROVIDER=browserbase requires BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID"
            )
        return {"X-BB-API-Key": self.api_key, "Content-Type": "application/json"}

    async def create(self, run_id: str) -> BrowserSession:
        import httpx

        headers = self._headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{BROWSERBASE_API}/sessions",
                headers=headers,
                json={"projectId": self.project_id, "keepAlive": False},
            )
        if resp.status_code >= 400:
            raise BrowserSessionError(f"browserbase session create failed ({resp.status_code})")
        data = resp.json()
        session_id = data.get("id")
        return BrowserSession(
            run_id=run_id,
            provider=self.name,
            session_id=session_id,
            cdp_url=data.get("connectUrl"),
            live_view_url=data.get("liveViewUrl") or data.get("debuggerFullscreenUrl"),
        )

    async def terminate(self, session: BrowserSession) -> None:
        session.cancelled = True
        if not session.session_id:
            return
        import httpx

        headers = self._headers()
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BROWSERBASE_API}/sessions/{session.session_id}",
                headers=headers,
                json={"projectId": self.project_id, "status": "REQUEST_RELEASE"},
            )
        if resp.status_code >= 400:
            raise BrowserSessionError(
                f"browserbase session terminate failed ({resp.status_code}) for {session.session_id}"
            )


def get_provider() -> BrowserProvider:
    """Select the provider from ``BROWSER_PROVIDER`` (default: local)."""
    name = (os.getenv("BROWSER_PROVIDER") or "local").strip().lower()
    if name in {"browserbase", "remote"}:
        return BrowserbaseProvider()
    if name not in {"local", "playwright"}:
        logger.warning("[BrowserSession] unknown BROWSER_PROVIDER=%r; falling back to local", name)
    return LocalPlaywrightProvider()


# --- run registry (kill switch) -------------------------------------------

_SESSIONS: Dict[str, BrowserSession] = {}


async def open_session(run_id: Optional[str], owner_id: Optional[str] = None) -> BrowserSession:
    """Create and register an isolated session for ``run_id``.

    ``owner_id`` binds the session to the authenticated user that started it;
    the kill switch refuses to terminate a session owned by someone else.
    """
    provider = get_provider()
    key = run_id or f"anon-{id(provider)}"
    session = await provider.create(key)
    session.owner_id = owner_id
    _SESSIONS[key] = session
    logger.info(
        "[Audit] component=browser-session action=open actor=%s run=%s provider=%s",
        owner_id or "-", key, session.provider,
    )
    return session


async def close_session(session: Optional[BrowserSession]) -> None:
    """Terminate and deregister a session; never raises."""
    if session is None:
        return
    try:
        await get_provider().terminate(session)
    except Exception as exc:  # noqa: BLE001 - cleanup must not mask run errors
        logger.warning("[BrowserSession] terminate failed for %s: %s", session.run_id, exc)
    _SESSIONS.pop(session.run_id, None)


def is_cancelled(run_id: Optional[str]) -> bool:
    if not run_id:
        return False
    session = _SESSIONS.get(run_id)
    return bool(session and session.cancelled)


def get_session(run_id: str) -> Optional[BrowserSession]:
    return _SESSIONS.get(run_id)


class BrowserAuthzError(PermissionError):
    """Raised when a caller tries to control a run they do not own."""


async def cancel_run(run_id: str, owner_id: Optional[str] = None) -> bool:
    """Kill switch: flag the run and terminate its remote browser.

    ``owner_id`` is the authenticated caller. When the session carries an
    owner, it must match — otherwise ``BrowserAuthzError`` is raised and the
    session is left untouched. Returns True when a live session was found and
    terminated.
    """
    session = _SESSIONS.get(run_id)
    if session is None:
        logger.info(
            "[Audit] component=browser-session action=cancel actor=%s run=%s outcome=not-found",
            owner_id or "-", run_id,
        )
        return False
    if session.owner_id and owner_id != session.owner_id:
        logger.warning(
            "[Audit] component=browser-session action=cancel actor=%s run=%s outcome=denied owner=%s",
            owner_id or "-", run_id, session.owner_id,
        )
        raise BrowserAuthzError("run does not belong to caller")
    session.cancelled = True
    await close_session(session)
    logger.info(
        "[Audit] component=browser-session action=cancel actor=%s run=%s outcome=terminated",
        owner_id or "-", run_id,
    )
    return True
