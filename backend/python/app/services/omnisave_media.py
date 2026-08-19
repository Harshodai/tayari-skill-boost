"""Fail-closed binary media mirroring contracts for OmniSaveAI.

The existing capture path stores validated HTTPS media metadata only. This
module deliberately does not enable binary mirroring by default. A deployment
must provide an audited public-media fetcher, malware scanner, object store,
retention policy, rights/deletion policy, and explicit feature enablement.
"""
from __future__ import annotations

import hashlib
import ipaddress
import os
import socket
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Protocol
from urllib.parse import urlsplit, urlunsplit

ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MIRROR_ENABLED_ENV = "OMNISAVE_MEDIA_MIRROR_ENABLED"


class MediaPolicyError(ValueError):
    """Raised when a media mirror request violates the safety contract."""


class MalwareScanner(Protocol):
    async def scan(self, content: bytes, content_type: str) -> str: ...


class ObjectStore(Protocol):
    async def put(self, key: str, content: bytes, content_type: str, metadata: dict[str, str]) -> str: ...
    async def delete(self, key: str) -> None: ...


MediaFetcher = Callable[[str], Awaitable[tuple[bytes, str]]]


@dataclass(frozen=True)
class MediaMirrorPolicy:
    max_bytes: int = 10 * 1024 * 1024
    max_redirects: int = 2
    allowed_types: frozenset[str] = frozenset(ALLOWED_MEDIA_TYPES)
    require_https: bool = True
    require_malware_scan: bool = True
    require_retention_days: int = 30

    def validate_url(self, value: str) -> str:
        parsed = urlsplit(str(value or "").strip())
        if self.require_https and parsed.scheme.lower() != "https":
            raise MediaPolicyError("media_https_required")
        if not parsed.hostname or parsed.username or parsed.password:
            raise MediaPolicyError("media_host_required")
        if parsed.port not in (None, 443):
            raise MediaPolicyError("media_port_not_allowed")
        return urlunsplit(("https", parsed.hostname.lower().rstrip("."), parsed.path or "/", parsed.query, ""))

    def validate_resolved_addresses(self, host: str, addresses: list[str]) -> None:
        if not addresses:
            raise MediaPolicyError("media_dns_resolution_failed")
        for raw in addresses:
            try:
                address = ipaddress.ip_address(raw)
            except ValueError as exc:
                raise MediaPolicyError("media_dns_address_invalid") from exc
            if any((address.is_private, address.is_loopback, address.is_link_local, address.is_reserved, address.is_multicast, address.is_unspecified)):
                raise MediaPolicyError("media_private_address_blocked")

    def validate_response(self, content_type: str, content_length: int | None, body: bytes) -> str:
        normalized_type = str(content_type or "").split(";", 1)[0].strip().lower()
        if normalized_type not in self.allowed_types:
            raise MediaPolicyError("media_content_type_blocked")
        if content_length is not None and content_length > self.max_bytes:
            raise MediaPolicyError("media_content_length_exceeded")
        if len(body) > self.max_bytes:
            raise MediaPolicyError("media_body_size_exceeded")
        return normalized_type

    def object_key(self, user_id: str, source_id: str, media_url: str) -> str:
        digest = hashlib.sha256(self.validate_url(media_url).encode("utf-8")).hexdigest()
        return f"omnisave/{user_id}/{source_id}/{digest}"


def resolve_public_addresses(host: str) -> list[str]:
    try:
        records = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise MediaPolicyError("media_dns_resolution_failed") from exc
    return sorted({record[4][0] for record in records})


@dataclass(frozen=True)
class MirrorResult:
    status: str
    key: str | None = None
    content_type: str | None = None
    sha256: str | None = None
    bytes_stored: int = 0
    scanner_verdict: str | None = None


async def mirror_media_item(
    *,
    policy: MediaMirrorPolicy,
    user_id: str,
    source_id: str,
    media_url: str,
    fetcher: MediaFetcher,
    scanner: MalwareScanner | None,
    store: ObjectStore | None,
    retention_days: int | None = None,
) -> MirrorResult:
    """Mirror one media item only when every safety dependency is present.

    The default deployment flag is false. When enabled, this function requires
    an injected fetcher, malware scanner, and object store so an accidental
    direct download or unscreened upload cannot occur.
    """
    if os.getenv(MIRROR_ENABLED_ENV, "false").strip().lower() != "true":
        return MirrorResult(status="disabled")
    if scanner is None or store is None:
        raise MediaPolicyError("media_mirror_dependencies_required")
    if retention_days is None or retention_days < policy.require_retention_days:
        raise MediaPolicyError("media_retention_policy_required")

    normalized_url = policy.validate_url(media_url)
    host = urlsplit(normalized_url).hostname or ""
    policy.validate_resolved_addresses(host, resolve_public_addresses(host))
    content, content_type = await fetcher(normalized_url)
    safe_type = policy.validate_response(content_type, len(content), content)
    verdict = await scanner.scan(content, safe_type)
    if verdict.strip().lower() != "clean":
        raise MediaPolicyError("media_malware_scan_blocked")
    key = policy.object_key(user_id, source_id, normalized_url)
    stored_url = await store.put(key, content, safe_type, {"owner_id": user_id, "source_id": source_id, "retention_days": str(retention_days), "sha256": hashlib.sha256(content).hexdigest()})
    return MirrorResult(status="mirrored", key=stored_url or key, content_type=safe_type, sha256=hashlib.sha256(content).hexdigest(), bytes_stored=len(content), scanner_verdict=verdict)


async def delete_mirrored_media(*, store: ObjectStore, key: str) -> None:
    if not key.startswith("omnisave/"):
        raise MediaPolicyError("media_object_key_invalid")
    await store.delete(key)


__all__ = [
    "ALLOWED_MEDIA_TYPES",
    "MediaMirrorPolicy",
    "MediaPolicyError",
    "MirrorResult",
    "delete_mirrored_media",
    "mirror_media_item",
    "resolve_public_addresses",
]
