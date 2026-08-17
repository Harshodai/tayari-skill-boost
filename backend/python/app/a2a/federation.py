"""Safe outbound A2A federation primitives.

The client is intentionally opt-in. It does not discover arbitrary agents, trust
remote cards without a configured fingerprint, or dispatch when federation is
disabled by launch scope.
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import time
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from app.a2a.models import A2AMessage, AgentCard, A2AResponse
from app.services.capabilities import Capability, capability_enabled


class FederationNotEnabled(RuntimeError):
    pass


class FederationRejected(RuntimeError):
    pass


class RemoteAgentConfig(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=8, max_length=500)
    card_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


def _safe_peer_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.path not in {"", "/"}:
        return False
    host = parsed.hostname.rstrip(".").lower()
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return host not in {"localhost", "localhost.localdomain"} and not host.endswith((".local", ".internal"))
    return not (address.is_private or address.is_loopback or address.is_link_local or address.is_reserved or address.is_multicast or address.is_unspecified)


def _canonical_json(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _sign(secret: str, timestamp: str, nonce: str, body: bytes) -> str:
    payload = b".".join((timestamp.encode(), nonce.encode(), body))
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


class A2AFederationClient:
    def __init__(self, client: httpx.AsyncClient | None = None):
        self.secret = os.getenv("A2A_FEDERATION_SECRET", "").strip()
        self._client = client

    def _validate(self, config: RemoteAgentConfig) -> None:
        if not capability_enabled(Capability.INTEGRATION_A2A_FEDERATION):
            raise FederationNotEnabled("A2A federation is disabled by launch scope")
        if not self.secret:
            raise FederationNotEnabled("A2A_FEDERATION_SECRET is not configured")
        if not _safe_peer_url(config.base_url):
            raise FederationRejected("A2A peer URL must be HTTPS and public")
        allowed = {item.strip().rstrip("/") for item in os.getenv("A2A_ALLOWED_PEERS", "").split(",") if item.strip()}
        if config.base_url.rstrip("/") not in allowed:
            raise FederationRejected("A2A peer is not allowlisted")

    async def fetch_agent_card(self, config: RemoteAgentConfig) -> AgentCard:
        self._validate(config)
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=3.0), follow_redirects=False)
        try:
            response = await client.get(f"{config.base_url.rstrip('/')}/.well-known/agent-card.json", headers={"Authorization": f"Bearer {self.secret}"})
            response.raise_for_status()
            raw = response.json()
            if hashlib.sha256(_canonical_json(raw)).hexdigest() != config.card_sha256:
                raise FederationRejected("Remote Agent Card fingerprint mismatch")
            return AgentCard.model_validate(raw)
        except FederationRejected:
            raise
        except (httpx.HTTPError, ValueError) as exc:
            raise FederationRejected("Remote Agent Card could not be verified") from exc
        finally:
            if owns_client:
                await client.aclose()

    async def dispatch(self, config: RemoteAgentConfig, message: A2AMessage) -> A2AResponse:
        self._validate(config)
        body = _canonical_json(message.model_dump())
        timestamp = str(int(time.time()))
        nonce = secrets.token_urlsafe(18)
        headers = {
            "Authorization": f"Bearer {self.secret}",
            "Content-Type": "application/json",
            "X-A2A-Timestamp": timestamp,
            "X-A2A-Nonce": nonce,
            "X-A2A-Signature": _sign(self.secret, timestamp, nonce, body),
        }
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0), follow_redirects=False)
        try:
            response = await client.post(f"{config.base_url.rstrip('/')}/api/v1/a2a/dispatch", content=body, headers=headers)
            response.raise_for_status()
            return A2AResponse.model_validate(response.json())
        except FederationRejected:
            raise
        except (httpx.HTTPError, ValueError) as exc:
            raise FederationRejected("Remote A2A dispatch failed") from exc
        finally:
            if owns_client:
                await client.aclose()
