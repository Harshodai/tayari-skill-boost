"""Canonical application lifecycle and optimistic transition checks.

The legacy ``status`` field is retained for API compatibility, while callers can
use ``lifecycle_state`` and ``lifecycle_version`` to distinguish preparation,
review, approval, attempts, receipts, and external verification. This module is
pure and persistence-agnostic so database-backed callers can apply the same
rules inside an atomic transaction.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final


PREPARED: Final = "prepared"
REVIEWED: Final = "reviewed"
CANDIDATE_CONFIRMED: Final = "candidate_confirmed"
APPROVED: Final = "approved"
ATTEMPTED: Final = "attempted"
RECEIPT_CONFIRMED: Final = "receipt_confirmed"
EXTERNALLY_VERIFIED: Final = "externally_verified"
FAILED: Final = "failed"
WITHDRAWN: Final = "withdrawn"

CANONICAL_STATES: Final = frozenset(
    {
        PREPARED,
        REVIEWED,
        CANDIDATE_CONFIRMED,
        APPROVED,
        ATTEMPTED,
        RECEIPT_CONFIRMED,
        EXTERNALLY_VERIFIED,
        FAILED,
        WITHDRAWN,
    }
)

# A receipt or provider response is not an external verification by itself.
# The final edge requires an independent, owner-visible verification event.
VALID_TRANSITIONS: Final = {
    PREPARED: frozenset({REVIEWED, FAILED, WITHDRAWN}),
    REVIEWED: frozenset({CANDIDATE_CONFIRMED, PREPARED, FAILED, WITHDRAWN}),
    CANDIDATE_CONFIRMED: frozenset({APPROVED, REVIEWED, FAILED, WITHDRAWN}),
    APPROVED: frozenset({ATTEMPTED, REVIEWED, FAILED, WITHDRAWN}),
    ATTEMPTED: frozenset({RECEIPT_CONFIRMED, FAILED, WITHDRAWN}),
    RECEIPT_CONFIRMED: frozenset({EXTERNALLY_VERIFIED, FAILED, WITHDRAWN}),
    EXTERNALLY_VERIFIED: frozenset({WITHDRAWN}),
    FAILED: frozenset({PREPARED, REVIEWED, WITHDRAWN}),
    WITHDRAWN: frozenset(),
}

LEGACY_TO_CANONICAL: Final = {
    "ready_to_submit": PREPARED,
    "gate_blocked": PREPARED,
    "skipped_ats_tier": PREPARED,
    "prepared_ats_difficult": PREPARED,
    "awaiting_approval": REVIEWED,
    "approval_expired_or_replayed": REVIEWED,
    "skipped_linkedin_policy": REVIEWED,
    "submitted_unverified": ATTEMPTED,
    "applied": RECEIPT_CONFIRMED,
    "apply_failed": FAILED,
}


class InvalidApplicationTransition(ValueError):
    """Raised when a lifecycle edge or optimistic version check fails."""


@dataclass(frozen=True)
class LifecycleTransition:
    state: str
    version: int


def canonical_state(value: str | None) -> str:
    """Normalize a canonical or legacy status, failing closed on unknown input."""
    candidate = (value or PREPARED).strip().lower()
    if candidate in CANONICAL_STATES:
        return candidate
    if candidate in LEGACY_TO_CANONICAL:
        return LEGACY_TO_CANONICAL[candidate]
    raise InvalidApplicationTransition(f"unknown application lifecycle state: {value!r}")


def can_transition(current: str | None, new: str, *, expected_version: int | None = None, version: int = 1) -> bool:
    """Return whether a transition is valid without changing state."""
    try:
        current_state = canonical_state(current)
        new_state = canonical_state(new)
    except InvalidApplicationTransition:
        return False
    if expected_version is not None and expected_version != version:
        return False
    return current_state == new_state or new_state in VALID_TRANSITIONS[current_state]


def transition(current: str | None, new: str, *, version: int = 1, expected_version: int | None = None) -> LifecycleTransition:
    """Validate a transition and return the next state/version.

    ``expected_version`` is the optimistic-concurrency guard that persistence
    callers should include in their ``UPDATE ... WHERE version = ?`` predicate.
    """
    current_state = canonical_state(current)
    new_state = canonical_state(new)
    if expected_version is not None and expected_version != version:
        raise InvalidApplicationTransition("stale application lifecycle version")
    if current_state != new_state and new_state not in VALID_TRANSITIONS[current_state]:
        raise InvalidApplicationTransition(f"illegal application transition: {current_state} -> {new_state}")
    return LifecycleTransition(new_state, version if current_state == new_state else version + 1)
