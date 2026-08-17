from __future__ import annotations

import pytest

from app.services.browser_automation.session import (
    BrowserSessionError,
    OpenSandboxProvider,
    get_provider,
)


def configure(monkeypatch, app_env="development"):
    monkeypatch.setenv("APP_ENV", app_env)
    monkeypatch.setenv("CAPABILITY_WORKSPACE_ISOLATED_COMPUTER", "true")
    monkeypatch.setenv("OPENSANDBOX_API_URL", "https://sandbox.example.test")
    monkeypatch.setenv("OPENSANDBOX_API_TOKEN", "token-not-real")
    monkeypatch.setenv("OPENSANDBOX_IMAGE", "registry.example.test/tayari/browser@sha256:" + "a" * 64)


def test_opensandbox_requires_explicit_configuration(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("CAPABILITY_WORKSPACE_ISOLATED_COMPUTER", "true")
    monkeypatch.delenv("OPENSANDBOX_API_URL", raising=False)
    monkeypatch.delenv("OPENSANDBOX_API_TOKEN", raising=False)
    monkeypatch.delenv("OPENSANDBOX_IMAGE", raising=False)
    with pytest.raises(BrowserSessionError, match="requires OPENSANDBOX"):
        OpenSandboxProvider()._headers()


def test_opensandbox_requires_https_outside_development(monkeypatch):
    configure(monkeypatch, "staging")
    monkeypatch.setenv("OPENSANDBOX_API_URL", "http://sandbox.example.test")
    with pytest.raises(BrowserSessionError, match="HTTPS"):
        OpenSandboxProvider()._headers()


def test_opensandbox_endpoint_requires_private_host(monkeypatch):
    configure(monkeypatch)
    provider = OpenSandboxProvider()
    with pytest.raises(BrowserSessionError, match="private"):
        provider._private_endpoint("https://public.example.test/cdp")
    monkeypatch.setenv("OPENSANDBOX_PRIVATE_HOST_SUFFIX", ".sandbox.internal")
    assert provider._private_endpoint("https://browser.sandbox.internal/cdp") == "https://browser.sandbox.internal/cdp"


@pytest.mark.asyncio
async def test_opensandbox_create_and_terminate_use_private_control_plane(monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("OPENSANDBOX_PRIVATE_HOST_SUFFIX", ".sandbox.internal")

    class Response:
        status_code = 200

        def json(self):
            return {"id": "sandbox-123", "browser_connect_url": "https://browser.sandbox.internal/cdp", "live_view_url": "https://view.sandbox.internal/vnc"}

    class Client:
        requests = []

        def __init__(self, *args, **kwargs):
            self.kwargs = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            self.requests.append(("post", url, kwargs))
            return Response()

        async def delete(self, url, **kwargs):
            self.requests.append(("delete", url, kwargs))
            return Response()

    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", Client)
    provider = OpenSandboxProvider()
    session = await provider.create("run-123")
    assert session.session_id == "sandbox-123"
    assert session.cdp_url == "https://browser.sandbox.internal/cdp"
    assert Client.requests[0][2]["json"]["network_policy"] == "deny_private_allowlist"
    await provider.terminate(session)
    assert session.cancelled is True
    assert Client.requests[1][0] == "delete"


def test_provider_selector_exposes_local_bridge_and_opensandbox(monkeypatch):
    monkeypatch.setenv("BROWSER_PROVIDER", "local_bridge")
    assert get_provider().name == "local_bridge"
    monkeypatch.setenv("BROWSER_PROVIDER", "opensandbox")
    assert get_provider().name == "opensandbox"
