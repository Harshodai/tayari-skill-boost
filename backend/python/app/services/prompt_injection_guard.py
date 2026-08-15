from __future__ import annotations

import re
from dataclasses import dataclass

PATTERNS = (
    r"ignore\s+(all|any|previous|the)\s+instructions?",
    r"system\s+message",
    r"developer\s+message",
    r"reveal\s+(the\s+)?prompt",
    r"upload\s+.*file",
    r"send\s+.*(credential|password|token)",
    r"click\s+.*(allow|approve|submit)",
)

@dataclass(frozen=True)
class GuardResult:
    blocked: bool
    reason: str
    matches: tuple[str, ...] = ()

def inspect_untrusted_text(text: str) -> GuardResult:
    matches = tuple(pattern for pattern in PATTERNS if re.search(pattern, str(text or ""), re.I))
    reason = "Page content contains instruction-like text and is treated as data only." if matches else "No instruction-like markers detected."
    return GuardResult(bool(matches), reason, matches)

def assert_safe_untrusted_text(text: str) -> None:
    result = inspect_untrusted_text(text)
    if result.blocked:
        raise ValueError(result.reason)
