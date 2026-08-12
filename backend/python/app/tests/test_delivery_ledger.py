from __future__ import annotations

import asyncio

import pytest

from app.services import delivery_ledger


def test_claim_requires_explicit_supported_channel_set():
    with pytest.raises(ValueError):
        asyncio.run(delivery_ledger.claim_next_delivery(()))
    with pytest.raises(ValueError):
        asyncio.run(delivery_ledger.claim_next_delivery(("signal",)))


def test_telegram_refuses_to_send_without_official_bot_configuration(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    delivery = delivery_ledger.Delivery(
        delivery_id="delivery-1",
        user_id="candidate-1",
        event_key="event-1",
        channel="telegram",
        payload={"destination": "123", "text": "A draft is ready."},
    )
    with pytest.raises(delivery_ledger.DeliveryConfigurationError):
        asyncio.run(delivery_ledger.send_telegram(delivery))


def test_whatsapp_refuses_to_send_without_official_cloud_api_configuration(monkeypatch):
    monkeypatch.delenv("WHATSAPP_CLOUD_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_CLOUD_PHONE_NUMBER_ID", raising=False)
    delivery = delivery_ledger.Delivery(
        delivery_id="delivery-1",
        user_id="candidate-1",
        event_key="event-1",
        channel="whatsapp",
        payload={"destination": "15551234567", "text": "A draft is ready."},
    )
    with pytest.raises(delivery_ledger.DeliveryConfigurationError):
        asyncio.run(delivery_ledger.send_whatsapp(delivery))


def test_dispatch_records_provider_receipt(monkeypatch):
    delivery = delivery_ledger.Delivery(
        delivery_id="delivery-1",
        user_id="candidate-1",
        event_key="event-1",
        channel="telegram",
        payload={"destination": "123", "text": "A draft is ready."},
    )
    receipts: list[tuple[str, str | None]] = []

    async def fake_claim():
        return delivery

    async def fake_send(record):
        assert record is delivery
        return "telegram-message-9"

    async def fake_mark_sent(record, provider_message_id=None):
        receipts.append((record.delivery_id, provider_message_id))
        return True

    monkeypatch.setattr(delivery_ledger, "claim_next_delivery", fake_claim)
    monkeypatch.setattr(delivery_ledger, "send_telegram", fake_send)
    monkeypatch.setattr(delivery_ledger, "mark_sent", fake_mark_sent)

    assert asyncio.run(delivery_ledger.dispatch_once()) is delivery
    assert receipts == [("delivery-1", "telegram-message-9")]
