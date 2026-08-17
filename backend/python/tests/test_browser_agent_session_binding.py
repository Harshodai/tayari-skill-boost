from types import SimpleNamespace

import pytest

from app.services.browser_automation.agent import _build_agent
from app.services.browser_automation.session import BrowserSessionError


def test_local_bridge_is_never_passed_to_browser_use():
    class Agent:
        called = False

        def __new__(cls, *args, **kwargs):
            cls.called = True
            return object.__new__(cls)

    session = SimpleNamespace(provider="local_bridge", cdp_url=None)
    with pytest.raises(BrowserSessionError, match="local_bridge sessions"):
        _build_agent(Agent, "observe", object(), None, session)
    assert Agent.called is False


def test_remote_session_binding_failure_does_not_fallback_to_local():
    calls = []

    def agent_factory(*args, **kwargs):
        calls.append(kwargs)
        if any(key in kwargs for key in ("cdp_url", "browser_session", "wss_url")):
            raise TypeError("unsupported constructor keyword")
        return object()

    session = SimpleNamespace(provider="opensandbox", cdp_url="https://browser.sandbox.internal/cdp")
    with pytest.raises(BrowserSessionError, match="could not bind"):
        _build_agent(agent_factory, "observe", object(), None, session)
    assert all("cdp_url" in call or "browser_session" in call or "wss_url" in call for call in calls)
