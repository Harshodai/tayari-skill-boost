import hashlib
import json

import httpx
import pytest

from app.a2a.federation import (
    A2AFederationClient,
    FederationNotEnabled,
    FederationRejected,
    ReplayProtector,
    RemoteAgentConfig,
    _canonical_json,
    _safe_peer_url,
    _sign,
    verify_signed_federation_request,
)
from app.a2a.models import A2AMessage


def test_peer_url_policy_rejects_private_and_non_https_hosts():
    assert _safe_peer_url("https://partner.example.com") is True
    assert _safe_peer_url("http://partner.example.com") is False
    assert _safe_peer_url("https://127.0.0.1") is False
    assert _safe_peer_url("https://agent.internal") is False


@pytest.mark.asyncio
async def test_federation_requires_explicit_capability(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CAPABILITY_INTEGRATION_A2A_FEDERATION", raising=False)
    monkeypatch.setenv("A2A_FEDERATION_SECRET", "federation-test-secret")
    client = A2AFederationClient()
    config = RemoteAgentConfig(
        name="partner",
        base_url="https://partner.example.com",
        card_sha256="0" * 64,
    )

    with pytest.raises(FederationNotEnabled, match="disabled by launch scope"):
        await client.fetch_agent_card(config)


@pytest.mark.asyncio
async def test_federation_verifies_card_and_signs_dispatch(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("CAPABILITY_INTEGRATION_A2A_FEDERATION", "true")
    monkeypatch.setenv("A2A_FEDERATION_SECRET", "federation-test-secret")
    monkeypatch.setenv("A2A_ALLOWED_PEERS", "https://partner.example.com")
    card = {
        "name": "partner",
        "description": "Synthetic partner research agent",
        "version": "1.0.0",
        "url": "https://partner.example.com",
        "capabilities": [],
        "metadata": {},
    }
    card_hash = hashlib.sha256(_canonical_json(card)).hexdigest()
    seen: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.method == "GET":
            return httpx.Response(200, json=card)
        body = json.loads(request.content)
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": {"ok": True}, "trace_id": body["trace_id"]})

    config = RemoteAgentConfig(name="partner", base_url="https://partner.example.com", card_sha256=card_hash)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        client = A2AFederationClient(http_client)
        verified = await client.fetch_agent_card(config)
        response = await client.dispatch(
            config,
            A2AMessage(sender="tayari", recipient="partner", method="task.delegate", params={"query": "public jobs"}),
        )

    assert verified.name == "partner"
    assert response.result == {"ok": True}
    assert seen[0].headers["authorization"] == "Bearer federation-test-secret"
    assert seen[1].headers["x-a2a-signature"]
    assert seen[1].headers["x-a2a-nonce"]


@pytest.mark.asyncio
async def test_signed_request_rejects_tampering_and_replay(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    body = b'{"jsonrpc":"2.0"}'
    timestamp = "1700000000"
    nonce = "unique-test-nonce"
    signature = _sign("federation-test-secret", timestamp, nonce, body)
    protector = ReplayProtector()

    await verify_signed_federation_request(
        secret="federation-test-secret",
        timestamp=timestamp,
        nonce=nonce,
        signature=signature,
        body=body,
        replay_protector=protector,
        now=1700000000,
    )
    with pytest.raises(FederationRejected, match="already been used"):
        await verify_signed_federation_request(
            secret="federation-test-secret",
            timestamp=timestamp,
            nonce=nonce,
            signature=signature,
            body=body,
            replay_protector=protector,
            now=1700000000,
        )
    with pytest.raises(FederationRejected, match="signature"):
        await verify_signed_federation_request(
            secret="federation-test-secret",
            timestamp=timestamp,
            nonce="tampered",
            signature=signature,
            body=body,
            replay_protector=ReplayProtector(),
            now=1700000000,
        )


@pytest.mark.asyncio
async def test_signed_request_requires_durable_replay_protection_in_staging(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    with pytest.raises(FederationRejected, match="requires Redis"):
        await verify_signed_federation_request(
            secret="federation-test-secret",
            timestamp="1700000000",
            nonce="staging-nonce",
            signature=_sign("federation-test-secret", "1700000000", "staging-nonce", b"body"),
            body=b"body",
            now=1700000000,
        )


@pytest.mark.asyncio
async def test_federation_rejects_card_fingerprint_mismatch(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("CAPABILITY_INTEGRATION_A2A_FEDERATION", "true")
    monkeypatch.setenv("A2A_FEDERATION_SECRET", "federation-test-secret")
    monkeypatch.setenv("A2A_ALLOWED_PEERS", "https://partner.example.com")

    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"name": "unexpected"})

    config = RemoteAgentConfig(name="partner", base_url="https://partner.example.com", card_sha256="0" * 64)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        with pytest.raises(FederationRejected, match="fingerprint"):
            await A2AFederationClient(http_client).fetch_agent_card(config)
