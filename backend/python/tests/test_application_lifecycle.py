import pytest

from app.services.application_lifecycle import (
    APPROVED,
    ATTEMPTED,
    CANDIDATE_CONFIRMED,
    EXTERNALLY_VERIFIED,
    PREPARED,
    RECEIPT_CONFIRMED,
    REVIEWED,
    InvalidApplicationTransition,
    can_transition,
    canonical_state,
    transition,
)


def test_canonical_flow_requires_review_and_candidate_confirmation():
    assert transition(PREPARED, REVIEWED).state == REVIEWED
    next_step = transition(REVIEWED, CANDIDATE_CONFIRMED, version=2, expected_version=2)
    assert next_step.state == CANDIDATE_CONFIRMED
    assert next_step.version == 3
    assert transition(CANDIDATE_CONFIRMED, APPROVED, version=3, expected_version=3).state == APPROVED
    assert transition(APPROVED, ATTEMPTED, version=4, expected_version=4).state == ATTEMPTED
    assert transition(ATTEMPTED, RECEIPT_CONFIRMED, version=5, expected_version=5).state == RECEIPT_CONFIRMED
    assert transition(RECEIPT_CONFIRMED, EXTERNALLY_VERIFIED, version=6, expected_version=6).state == EXTERNALLY_VERIFIED


def test_canonical_flow_rejects_direct_external_or_receipt_claims():
    assert not can_transition(PREPARED, APPROVED)
    assert not can_transition(PREPARED, ATTEMPTED)
    assert not can_transition(ATTEMPTED, EXTERNALLY_VERIFIED)
    with pytest.raises(InvalidApplicationTransition):
        transition(PREPARED, EXTERNALLY_VERIFIED)


def test_terminal_external_verification_cannot_be_replayed_or_reopened():
    assert not can_transition(EXTERNALLY_VERIFIED, EXTERNALLY_VERIFIED, expected_version=2, version=3)
    assert not can_transition(EXTERNALLY_VERIFIED, APPROVED)
    with pytest.raises(InvalidApplicationTransition, match="stale"):
        transition(REVIEWED, CANDIDATE_CONFIRMED, version=4, expected_version=3)


def test_legacy_statuses_normalize_without_claiming_verification():
    assert canonical_state("ready_to_submit") == PREPARED
    assert canonical_state("awaiting_approval") == REVIEWED
    assert canonical_state("submitted_unverified") == ATTEMPTED
    assert canonical_state("applied") == RECEIPT_CONFIRMED
    assert canonical_state("apply_failed") == "failed"
    assert canonical_state(None) == PREPARED
    assert not can_transition("submitted_unverified", EXTERNALLY_VERIFIED)


def test_unknown_status_fails_closed():
    assert not can_transition("unknown_status", PREPARED)
    with pytest.raises(InvalidApplicationTransition, match="unknown"):
        transition("unknown_status", PREPARED)
