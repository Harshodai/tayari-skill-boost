from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# High-confidence instruction/safety markers: any match blocks the payload.
# These describe instructions TO the model or attempts to extract secrets.
HIGH_CONFIDENCE_PATTERNS = (
    r"<<<UNTRUSTED_USER_DATA>>>",
    r"\b(ignore|disregard)\s+(all|any|the|previous|prior)\s+(instructions?|rules?|directions?)\b",
    r"\b(system|developer|assistant)\s+(message|prompt|instruction)\b",
    r"\b(reveal|show|print|leak|expose)\s+(the\s+)?(system\s+)?prompt\b",
    r"\b(do not|don't)\s+(tell|show|mention)\s+(the\s+)?user\b",
    r"\b(send|upload|post|share|exfiltrate)\b.{0,80}\b(password|credential|token|secret|api[_ -]?key|cookie)\b",
)

# Action-shaped phrasing: benign page text ("Click approve and continue...",
# "Enter the OTP...") commonly contains it, so it is a warning, not a block.
# The model still treats the text as data (it is wrapped in _untrusted); the
# warning exists so callers can log the presence of instruction-like phrasing.
ACTION_PATTERNS = (
    r"\b(click|press|select)\b.{0,80}\b(allow|approve|submit|authorize|continue)\b",
    r"\b(navigate|redirect|go)\b.{0,80}\bhttps?://",
    r"\b(enter|type|paste)\b.{0,80}\b(password|credential|token|secret|otp|mfa)\b",
)

PATTERNS = HIGH_CONFIDENCE_PATTERNS + ACTION_PATTERNS


@dataclass(frozen=True)
class GuardResult:
    blocked: bool
    reason: str
    matches: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()


def inspect_untrusted_text(text: str) -> GuardResult:
    normalized = unicodedata.normalize("NFKC", str(text or ""))
    value = "".join(ch for ch in normalized if unicodedata.category(ch) != "Cf")
    matches = tuple(pattern for pattern in HIGH_CONFIDENCE_PATTERNS if re.search(pattern, value, re.I | re.S))
    warnings = tuple(pattern for pattern in ACTION_PATTERNS if re.search(pattern, value, re.I | re.S))
    if matches:
        reason = "Page content contains instruction-like text and is treated as data only."
    elif warnings:
        reason = "Page content contains action-shaped phrasing; treated as data only."
    else:
        reason = "No instruction-like markers detected."
    return GuardResult(bool(matches), reason, matches, warnings)


def assert_safe_untrusted_text(text: str) -> None:
    result = inspect_untrusted_text(text)
    if result.blocked:
        raise ValueError(result.reason)
