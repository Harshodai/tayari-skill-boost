"""Explicit-consent OmniSaveAI destination adapter contracts.

Adapters are intentionally transport- and token-provider-injected. They do not
accept provider tokens from browser payloads, do not persist tokens, and do not
perform network calls unless a caller supplies an authenticated server-side
transport plus an owner-scoped idempotency ledger.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Literal, Protocol
from urllib.parse import quote

DestinationName = Literal["google_sheets", "notion", "airtable", "miro"]
DESTINATIONS = frozenset({"google_sheets", "notion", "airtable", "miro"})


class DestinationConfigurationError(ValueError):
    pass


class DestinationDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class TransportResponse:
    status_code: int
    body: dict[str, Any]


Transport = Callable[[str, str, dict[str, str], dict[str, Any]], Awaitable[TransportResponse]]


class DeliveryLedger(Protocol):
    async def reserve(self, *, user_id: str, destination: str, target: str, event_key: str) -> bool: ...
    async def mark_success(self, *, event_key: str, provider_id: str) -> None: ...
    async def mark_failure(self, *, event_key: str, error: str) -> None: ...


def _require(value: Any, name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise DestinationConfigurationError(f"{name}_required")
    return normalized


def _rows(bundle: dict[str, Any]) -> list[list[str]]:
    rows = [["Title", "URL", "Platform", "Author", "Category", "Summary"]]
    for source in (bundle.get("sources") or [])[:5000]:
        if not isinstance(source, dict):
            continue
        rows.append([
            str(source.get("title") or "")[:240],
            str(source.get("url") or "")[:2048],
            str(source.get("platform") or "")[:32],
            str(source.get("author") or "")[:160],
            str(source.get("category") or "")[:80],
            " | ".join(str(item) for item in (source.get("summary") or [])[:5])[:500],
        ])
    return rows


def _event_key(user_id: str, destination: str, target: str, bundle: dict[str, Any]) -> str:
    exported_at = str(bundle.get("exported_at") or "")
    digest = hashlib.sha256(f"{destination}:{target}:{exported_at}:{bundle.get('source_count', 0)}".encode()).hexdigest()
    return f"omnisave:{user_id}:{destination}:{digest}"[:300]


async def _request(transport: Transport, method: str, url: str, token: str, event_key: str, payload: dict[str, Any], extra_headers: dict[str, str] | None = None) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {_require(token, 'access_token')}", "Content-Type": "application/json", "X-JobTayari-Idempotency-Key": event_key}
    headers.update(extra_headers or {})
    response = await transport(method, url, headers, payload)
    if response.status_code < 200 or response.status_code >= 300:
        raise DestinationDeliveryError(f"destination_http_{response.status_code}")
    return response.body


async def deliver_bundle(
    *,
    user_id: str,
    destination: DestinationName,
    target: str,
    access_token: str,
    bundle: dict[str, Any],
    transport: Transport,
    ledger: DeliveryLedger,
) -> dict[str, Any]:
    """Deliver one immutable bundle exactly once per owner/destination/target key."""
    if destination not in DESTINATIONS:
        raise DestinationConfigurationError("unsupported_destination")
    user_id = _require(user_id, "user_id")
    target = _require(target, "target")
    event_key = _event_key(user_id, destination, target, bundle)
    if not await ledger.reserve(user_id=user_id, destination=destination, target=target, event_key=event_key):
        return {"status": "already_reserved", "event_key": event_key, "destination": destination}
    try:
        body = await _deliver(destination, target, access_token, event_key, bundle, transport)
        provider_id = str(body.get("id") or body.get("spreadsheetId") or body.get("objectId") or event_key)
        await ledger.mark_success(event_key=event_key, provider_id=provider_id)
        return {"status": "delivered", "event_key": event_key, "destination": destination, "provider_id": provider_id}
    except Exception as exc:  # noqa: BLE001
        await ledger.mark_failure(event_key=event_key, error=str(exc))
        raise


async def _deliver(destination: DestinationName, target: str, token: str, event_key: str, bundle: dict[str, Any], transport: Transport) -> dict[str, Any]:
    rows = _rows(bundle)
    if destination == "google_sheets":
        spreadsheet_id = _require(target, "spreadsheet_id")
        encoded_range = quote("OmniSave!A1", safe="")
        return await _request(
            transport,
            "POST",
            f"https://sheets.googleapis.com/v4/spreadsheets/{quote(spreadsheet_id, safe='')}/values/{encoded_range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
            token,
            event_key,
            {"majorDimension": "ROWS", "values": rows},
        )
    if destination == "notion":
        database_id = _require(target, "database_id")
        return await _request(
            transport,
            "POST",
            "https://api.notion.com/v1/pages",
            token,
            event_key,
            {
                "parent": {"database_id": database_id},
                "properties": {"Name": {"title": [{"text": {"content": (rows[1][0] if len(rows) > 1 else "OmniSave export")[:240]}}]}},
                "children": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": f"JobTayari OmniSave export event {event_key}"}}]}}],
            },
            {"Notion-Version": "2022-06-28"},
        )
    if destination == "airtable":
        base_id, table_name = target.split("/", 1) if "/" in target else ("", "")
        base_id = _require(base_id, "base_id")
        table_name = _require(table_name, "table_name")
        records = [{"fields": {"Title": row[0], "URL": row[1], "Platform": row[2], "Author": row[3], "Category": row[4], "Summary": row[5]}} for row in rows[1:101]]
        return await _request(transport, "POST", f"https://api.airtable.com/v0/{quote(base_id, safe='')}/{quote(table_name, safe='')}", token, event_key, {"records": records, "typecast": False})
    if destination == "miro":
        board_id = _require(target, "board_id")
        title = rows[1][0] if len(rows) > 1 else "OmniSave export"
        return await _request(transport, "POST", f"https://api.miro.com/v1/boards/{quote(board_id, safe='')}/cards", token, event_key, {"data": {"title": title[:240], "description": f"JobTayari OmniSave export event {event_key}"}})
    raise DestinationConfigurationError("unsupported_destination")


__all__ = ["DESTINATIONS", "DestinationConfigurationError", "DestinationDeliveryError", "deliver_bundle"]
