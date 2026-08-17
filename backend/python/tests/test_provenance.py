import pytest

from app.services.provenance import (
    ProvenanceIntegrityConflict,
    canonical_json,
    classify_origin,
    payload_hash,
    sha256_text,
)


def test_hash_helpers_are_deterministic_and_canonical():
    assert sha256_text("resume") == sha256_text("resume")
    assert payload_hash({"b": 2, "a": 1}) == payload_hash({"a": 1, "b": 2})
    assert canonical_json({"b": 2, "a": 1}) == b'{"a":1,"b":2}'


def test_ai_generated_without_human_review_is_disclosed_as_ai_generated():
    decision = classify_origin([
        {"event_type": "ai_invoked"},
        {"event_type": "ai_generated"},
    ])
    assert decision.classification == "ai_generated"
    assert decision.user_label == "Created entirely by AI"
    assert "NO_QUALIFYING_HUMAN_REVIEW" in decision.reason_codes


def test_ai_output_with_human_edit_is_ai_assisted():
    decision = classify_origin([
        {"event_type": "ai_generated"},
        {"event_type": "human_edited"},
        {"event_type": "human_reviewed"},
    ])
    assert decision.classification == "ai_assisted"
    assert decision.user_label == "Created with AI assistance"
    assert decision.human_review_status == "reviewed"


def test_human_origin_without_ai_event_is_human_only():
    decision = classify_origin([{"event_type": "human_created"}, {"event_type": "human_reviewed"}])
    assert decision.classification == "human_only"
    assert decision.user_label == "Created by a human"


def test_machine_import_is_not_mislabeled_as_human():
    decision = classify_origin([{"event_type": "machine_imported"}])
    assert decision.classification == "machine_imported"
    assert decision.user_label == "Imported from an external system"


def test_missing_events_fail_closed_to_unknown():
    decision = classify_origin([])
    assert decision.classification == "unknown"
    assert "NO_ORIGIN_EVENTS" in decision.reason_codes


def test_failed_unknown_path_remains_unknown():
    decision = classify_origin([{"event_type": "failed"}])
    assert decision.classification == "unknown"
    assert "ORIGIN_EVENT_FAILED" in decision.reason_codes


def test_dispute_overrides_other_events():
    decision = classify_origin([
        {"event_type": "ai_generated"},
        {"event_type": "disputed"},
    ])
    assert decision.classification == "disputed"
    assert decision.human_review_status == "disputed"


def test_integrity_conflict_type_is_exported_for_callers():
    assert issubclass(ProvenanceIntegrityConflict, RuntimeError)
