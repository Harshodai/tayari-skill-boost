"""Durable, idempotent candidate-notification delivery ledger.

This is intentionally provider-neutral.  Telegram uses the official Bot API and
WhatsApp uses the official Meta Cloud API; no unofficial browser, QR, or
consumer-client automation is permitted.  Credentials stay in environment
variables and recipient destinations are stored only in the candidate-scoped
ledger payload.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Literal

from app.services.db import get_pool

logger = logging.getLogger(__name__)
Channel = Literal["in_app", "email", "telegram", "whatsapp"]
DELIVERY_CHANNELS = {"in_app", "email", "telegram", "whatsapp"}
MAX_ATTEMPTS = 5


class DeliveryConfigurationError(RuntimeError):
    """Raised when a candidate-enabled channel lacks its provider configuration."""


@dataclass(frozen=True)
class Delivery:
    delivery_id: str
    user_id: str
    event_key: str
    channel: Channel
    payload: dict[str, Any]
    attempt_count: int = 0


async def enqueue_delivery(
    *,
    user_id: str,
    event_key: str,
    channel: Channel,
    payload: dict[str, Any],
) -> str | None:
    """Queue an idempotent message. Returns its durable id or ``None`` without DB."""
    if channel not in DELIVERY_CHANNELS:
        raise ValueError("unsupported delivery channel")
    event_key = event_key.strip()
    if not event_key:
        raise ValueError("event_key is required")
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            delivery_id = await conn.fetchval(
                """
                INSERT INTO delivery_ledger (user_id, event_key, channel, payload)
                VALUES ($1::uuid, $2, $3, $4::jsonb)
                ON CONFLICT (user_id, event_key, channel) DO UPDATE
                SET updated_at = now()
                RETURNING delivery_id
                """,
                user_id,
                event_key[:300],
                channel,
                json.dumps(payload),
            )
        return str(delivery_id) if delivery_id else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("delivery ledger: enqueue failed for %s/%s (%s)", event_key, channel, exc)
        return None


async def claim_next_delivery(
    channels: tuple[Channel, ...] = ("telegram", "whatsapp"),
) -> Delivery | None:
    """Atomically claim a queued/retryable message using ``SKIP LOCKED``.

    A worker must name the channels it owns.  This prevents the messaging
    dispatcher from consuming in-app or email records that belong to a
    different delivery implementation.
    """
    if not channels or any(channel not in DELIVERY_CHANNELS for channel in channels):
        raise ValueError("at least one supported channel is required")
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    WITH next_delivery AS (
                        SELECT delivery_id
                        FROM delivery_ledger
                        WHERE status IN ('queued', 'failed')
                          AND available_at <= now()
                          AND attempt_count < $1
                          AND channel = ANY($2::text[])
                        ORDER BY available_at, created_at
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                    )
                    UPDATE delivery_ledger d
                    SET status = 'sending', attempt_count = d.attempt_count + 1, updated_at = now()
                    FROM next_delivery n
                    WHERE d.delivery_id = n.delivery_id
                    RETURNING d.delivery_id, d.user_id, d.event_key, d.channel, d.payload, d.attempt_count
                    """,
                    MAX_ATTEMPTS,
                    list(channels),
                )
        if not row:
            return None
        payload = row["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        return Delivery(
            delivery_id=str(row["delivery_id"]),
            user_id=str(row["user_id"]),
            event_key=str(row["event_key"]),
            channel=str(row["channel"]),  # type: ignore[arg-type]
            payload=dict(payload or {}),
            attempt_count=int(row["attempt_count"]),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("delivery ledger: claim failed (%s)", exc)
        return None


async def mark_sent(delivery: Delivery, provider_message_id: str | None = None) -> bool:
    return await _update_delivery(
        delivery.delivery_id,
        status="sent",
        provider_message_id=(provider_message_id or "")[:500] or None,
        sent=True,
    )


async def mark_failed(delivery: Delivery, error: str) -> bool:
    """Retry with bounded exponential backoff; suppress after the final attempt."""
    retry_seconds = min(300, 2 ** min(delivery.attempt_count, 8))
    status = "suppressed" if delivery.attempt_count >= MAX_ATTEMPTS else "failed"
    return await _update_delivery(
        delivery.delivery_id,
        status=status,
        last_error=error[:1000],
        retry_seconds=retry_seconds,
    )


async def _update_delivery(
    delivery_id: str,
    *,
    status: str,
    provider_message_id: str | None = None,
    last_error: str | None = None,
    retry_seconds: int | None = None,
    sent: bool = False,
) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            changed = await conn.fetchval(
                """
                UPDATE delivery_ledger
                SET status = $2,
                    provider_message_id = COALESCE($3, provider_message_id),
                    last_error = $4,
                    available_at = CASE
                        WHEN $5::integer IS NULL THEN available_at
                        ELSE now() + ($5::integer * interval '1 second')
                    END,
                    sent_at = CASE WHEN $6 THEN now() ELSE sent_at END,
                    updated_at = now()
                WHERE delivery_id = $1::uuid AND status = 'sending'
                RETURNING delivery_id
                """,
                delivery_id,
                status,
                provider_message_id,
                last_error,
                retry_seconds,
                sent,
            )
        return bool(changed)
    except Exception as exc:  # noqa: BLE001
        logger.warning("delivery ledger: update failed for %s (%s)", delivery_id, exc)
        return False


def _text_payload(delivery: Delivery) -> tuple[str, str]:
    destination = str(delivery.payload.get("destination") or "").strip()
    text = str(delivery.payload.get("text") or "").strip()
    if not destination or not text:
        raise ValueError("delivery payload requires destination and text")
    return destination, text[:4096]


async def send_telegram(delivery: Delivery) -> str:
    """Send through Telegram's official Bot API after explicit candidate opt-in."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise DeliveryConfigurationError("Telegram is not configured")
    destination, text = _text_payload(delivery)
    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": destination, "text": text, "disable_web_page_preview": True},
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Telegram send failed ({response.status_code})")
    body = response.json()
    if not body.get("ok"):
        raise RuntimeError("Telegram rejected the message")
    return str((body.get("result") or {}).get("message_id") or "telegram-accepted")


async def send_whatsapp(delivery: Delivery) -> str:
    """Send through Meta's official WhatsApp Cloud API, never a consumer client."""
    token = os.getenv("WHATSAPP_CLOUD_ACCESS_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "").strip()
    if not token or not phone_number_id:
        raise DeliveryConfigurationError("WhatsApp Cloud API is not configured")
    destination, text = _text_payload(delivery)
    import httpx

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"https://graph.facebook.com/v20.0/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": destination,
                "type": "text",
                "text": {"preview_url": False, "body": text},
            },
        )
    if response.status_code >= 400:
        raise RuntimeError(f"WhatsApp Cloud API send failed ({response.status_code})")
    body = response.json()
    messages = body.get("messages") or []
    return str((messages[0] if messages else {}).get("id") or "whatsapp-accepted")


async def dispatch_once() -> Delivery | None:
    """Claim and deliver one record.  All failures stay visible in the ledger."""
    delivery = await claim_next_delivery()
    if not delivery:
        return None
    try:
        if delivery.channel == "telegram":
            provider_id = await send_telegram(delivery)
        elif delivery.channel == "whatsapp":
            provider_id = await send_whatsapp(delivery)
        else:
            # In-app/email retain their established dispatcher ownership.  They
            # are never silently marked sent by this messaging-worker path.
            raise DeliveryConfigurationError(f"{delivery.channel} needs its dedicated dispatcher")
        await mark_sent(delivery, provider_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("delivery ledger: dispatch failed for %s (%s)", delivery.delivery_id, exc)
        await mark_failed(delivery, str(exc))
    return delivery


__all__ = [
    "Delivery",
    "DeliveryConfigurationError",
    "claim_next_delivery",
    "dispatch_once",
    "enqueue_delivery",
    "mark_failed",
    "mark_sent",
]
