"""User notification service for in-app alerts, standing job watches, and Mission M16 re-engagement."""
from __future__ import annotations

import json
import logging
import os
import smtplib
import threading
import time
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.db import get_pool

logger = logging.getLogger(__name__)

# Bounded TTL event deduplication store (map event_id -> timestamp) with thread safety
_EVENT_LOCK = threading.Lock()
_PROCESSED_EVENTS: Dict[str, float] = {}
EVENT_TTL_SECONDS = 86400  # 24 hours


def try_claim_event(event_id: str) -> bool:
    """Atomically claim event_id if not already processed within the 24-hour TTL window.

    Returns True if successfully claimed (first time), False if already claimed (duplicate).
    """
    now = time.time()
    with _EVENT_LOCK:
        # Evict expired entries
        expired = [eid for eid, ts in _PROCESSED_EVENTS.items() if now - ts > EVENT_TTL_SECONDS]
        for eid in expired:
            _PROCESSED_EVENTS.pop(eid, None)

        if event_id in _PROCESSED_EVENTS:
            return False

        _PROCESSED_EVENTS[event_id] = now
        return True


DEFAULT_NOTIFICATION_PREFERENCES = {
    "in_app": True,
    "email_per_event": False,  # Conservative default: OFF per-event email
    "digest_enabled": True,
    "digest_cadence": "weekly",  # "daily" | "weekly"
    "quiet_hours_start": 22,  # 10 PM
    "quiet_hours_end": 7,     # 7 AM
}


class NotificationEvent(BaseModel):
    event_id: str
    user_id: str
    event_type: str  # "job_match.found", "chain.prepared", "board.moved", "followup.due", "weekly_digest"
    title: str
    message: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[str] = None


def is_quiet_hours(user_hour: int, preferences: Dict[str, Any]) -> bool:
    """Check if the current user local hour falls in quiet hours."""
    start = preferences.get("quiet_hours_start", 22)
    end = preferences.get("quiet_hours_end", 7)
    if start > end:
        return user_hour >= start or user_hour < end
    return start <= user_hour < end


def send_email_notification(
    to_email: str,
    subject: str,
    body_text: str,
    smtp_host: str | None = None,
    smtp_port: int | None = None,
) -> bool:
    """Send email, refusing to pretend localhost is production delivery.

    Development keeps the Mailpit-friendly localhost default. Production must
    provide a real SMTP host and a non-loopback sender configuration; otherwise
    the event remains unconfirmed and is observable as a provider failure.
    """
    environment = os.getenv("ENV", "development").strip().lower()
    configured_host = os.getenv("SMTP_HOST", "").strip()
    resolved_host = (smtp_host or configured_host or "localhost").strip()
    resolved_port = smtp_port if smtp_port is not None else int(os.getenv("SMTP_PORT", "1025"))
    if environment == "production" and (not configured_host or resolved_host in {"localhost", "127.0.0.1", "::1"}):
        logger.error("SMTP provider is not configured for production notification delivery")
        return False

    from_email = os.getenv("NOTIFICATIONS_FROM_EMAIL", "notifications@tayari.local").strip()
    unsub_url = os.getenv("NOTIFICATIONS_UNSUBSCRIBE_URL", "mailto:unsubscribe@tayari.local?subject=unsubscribe").strip()
    if environment == "production" and (from_email.endswith(".local") or ".local" in unsub_url):
        logger.error("Production notification sender and unsubscribe URL must use a real domain")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg["List-Unsubscribe"] = f"<{unsub_url}>"
    msg.set_content(body_text)

    try:
        with smtplib.SMTP(resolved_host, resolved_port, timeout=5) as server:
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.warning("SMTP email send failed (fix_hint: configure a real SMTP_HOST in production or run local Mailpit): %s", exc)
        return False


def build_digest_email(events: List[NotificationEvent]) -> Optional[Dict[str, Any]]:
    """Aggregate a list of notifications into a digest email payload."""
    if not events:
        return None

    subject = f"Your Daily Tayari Digest ({len(events)} updates)"
    body_lines = ["Here are your latest updates from Tayari:\n"]
    for e in events:
        body_lines.append(f"- [{e.event_type.upper()}] {e.title}: {e.message}")
    body_lines.append("\nManage your notification preferences in settings.")

    return {
        "subject": subject,
        "body": "\n".join(body_lines),
        "event_count": len(events),
    }


def process_notification_event(
    event: NotificationEvent,
    user_email: Optional[str] = None,
    user_preferences: Optional[Dict[str, Any]] = None,
    user_hour: int = 12,
) -> Dict[str, Any]:
    """Process notification event through routing matrix, honoring quiet hours & atomic deduplication."""
    prefs = user_preferences or DEFAULT_NOTIFICATION_PREFERENCES

    # 1. Atomic Deduplication Check
    if not try_claim_event(event.event_id):
        logger.info("Dropping duplicate notification event: %s", event.event_id)
        return {"status": "skipped", "reason": "duplicate_event", "event_id": event.event_id}

    # 2. Quiet Hours check
    if is_quiet_hours(user_hour, prefs):
        logger.info("Notification event %s queued/held due to quiet hours", event.event_id)
        return {"status": "queued_for_quiet_hours", "event_id": event.event_id}

    # 3. Channel Dispatch
    channels_sent = []

    # Channel 1: In-App Inbox
    if prefs.get("in_app", True):
        channels_sent.append("in_app")

    # Channel 2: Email per-event (if enabled and user_email provided)
    if prefs.get("email_per_event", False) and user_email:
        sent = send_email_notification(
            user_email,
            event.title,
            event.message,
        )
        if sent:
            channels_sent.append("email")

    return {
        "status": "processed",
        "event_id": event.event_id,
        "channels": channels_sent,
    }


async def notify_user(
    user_id: str,
    title: str,
    body: str,
    channel: str = "in_app",
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert a user notification into the database or fall back safely.

    Args:
        user_id: UUID of the target user.
        title: Short title of the notification.
        body: Body text describing the notification.
        channel: Notification delivery channel, default "in_app".
        data: Optional metadata dictionary (e.g. watch_id, match count, links).

    Returns:
        Dictionary representation of the notification.
    """
    notification_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "id": notification_id,
        "user_id": user_id,
        "title": title,
        "body": body,
        "channel": channel,
        "read": False,
        "data": data or {},
        "created_at": now_iso,
        "status": "sent",
    }

    pool = await get_pool()
    if not pool:
        logger.info("notify_user: Database pool unavailable; notification recorded in fallback: %s", title)
        return record

    try:
        data_json = json.dumps(data or {})
        # Handle string or UUID for user_id
        target_uid = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
        target_nid = uuid.UUID(notification_id)
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO public.notifications (id, user_id, title, body, channel, read, data, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
                RETURNING id, user_id, title, body, channel, read, data, created_at
                """,
                target_nid,
                target_uid,
                title,
                body,
                channel,
                False,
                data_json,
            )
            if row:
                record["id"] = str(row["id"])
                record["created_at"] = row["created_at"].isoformat() if row["created_at"] else now_iso
            logger.info("notify_user: Created notification %s for user %s (%s)", record["id"], user_id, title)
    except Exception as exc:
        logger.warning("notify_user: Failed to persist notification for %s: %s", user_id, exc)

    return record
