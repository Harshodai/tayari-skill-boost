"""Notification Service & Re-engagement System (Mission M16)."""
import os
import time
import logging
import smtplib
import threading
from email.message import EmailMessage
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

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
    smtp_host: str = "localhost",
    smtp_port: int = 1025,
) -> bool:
    """Send plain-text-first notification email with mandatory List-Unsubscribe header."""
    from_email = os.getenv("NOTIFICATIONS_FROM_EMAIL", "notifications@tayari.local")
    unsub_url = os.getenv("NOTIFICATIONS_UNSUBSCRIBE_URL", "mailto:unsubscribe@tayari.local?subject=unsubscribe")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg["List-Unsubscribe"] = f"<{unsub_url}>"
    msg.set_content(body_text)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=5) as server:
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.warning("SMTP email send failed (fix_hint: configure SMTP_HOST in .env or run local Mailpit): %s", exc)
        return False


def build_digest_email(events: List[NotificationEvent]) -> Optional[Dict[str, Any]]:
    """Assemble daily/weekly digest email. Skips generation if no events occurred."""
    if not events:
        return None  # Never send empty digest

    matches = [e for e in events if e.event_type == "job_match.found"]
    prepared = [e for e in events if e.event_type == "chain.prepared"]
    followups = [e for e in events if e.event_type == "followup.due"]

    subject = f"Tayari Digest: {len(matches)} new matches, {len(prepared)} drafts ready"
    body_lines = ["While you were away:\n"]

    if matches:
        body_lines.append(f"• {len(matches)} new high-score job matches found:")
        for m in matches[:3]:
            body_lines.append(f"  - {m.title}: {m.message}")
    if prepared:
        body_lines.append(f"\n• {len(prepared)} application draft(s) prepared and awaiting your review.")
    if followups:
        body_lines.append(f"\n• {len(followups)} follow-up nudge(s) due.")

    body_lines.append("\nManage preferences or unsubscribe in your Tayari Settings.")
    return {
        "subject": subject,
        "body": "\n".join(body_lines),
        "event_count": len(events)
    }


def process_notification_event(
    event: NotificationEvent,
    user_email: Optional[str] = None,
    user_preferences: Optional[Dict[str, Any]] = None,
    user_hour: int = 12
) -> Dict[str, Any]:
    """Process notification event through routing matrix, honoring quiet hours & atomic deduplication."""
    prefs = user_preferences or DEFAULT_NOTIFICATION_PREFERENCES

    # Quiet hours check (runs BEFORE event claim so quiet-hours queued events can be redelivered)
    if is_quiet_hours(user_hour, prefs):
        return {"status": "queued_for_quiet_hours", "event_id": event.event_id}

    # Atomic event claim
    if not try_claim_event(event.event_id):
        return {"status": "skipped", "reason": "duplicate_event"}

    channels_sent = []

    # Channel 1: In-App Inbox
    if prefs.get("in_app", True):
        channels_sent.append("in_app")

    # Channel 2: Email per-event (if enabled and user_email provided)
    if prefs.get("email_per_event", False) and user_email:
        smtp_host = os.getenv("SMTP_HOST", "localhost")
        smtp_port = int(os.getenv("SMTP_PORT", "1025"))
        sent = send_email_notification(
            user_email,
            event.title,
            event.message,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
        )
        if sent:
            channels_sent.append("email")

    return {
        "status": "processed",
        "event_id": event.event_id,
        "channels": channels_sent
    }
