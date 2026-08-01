"""Unit tests for AgentAuditTrail deep-copy isolation and HMAC integrity."""

import pytest

from app.a2a.agent_audit_trail import INTEGRITY_FIELD, AgentAuditTrail


@pytest.fixture
def trail():
    return AgentAuditTrail(hmac_key="test-key")


def test_caller_mutation_after_record_does_not_change_stored_entry(trail):
    inputs = {"user": "u1", "nested": {"n": 1}}
    outputs = {"status": "ok", "items": [1, 2]}
    trail.record_agent_action("Builder", "tailor_resume", inputs, outputs)
    inputs["user"] = "tampered"
    inputs["nested"]["n"] = 99
    outputs["items"].append(3)
    stored = trail.get_logs()[0]
    assert stored["inputs"] == {"user": "u1", "nested": {"n": 1}}
    assert stored["outputs"] == {"status": "ok", "items": [1, 2]}


def test_mutating_returned_entry_does_not_affect_stored_records(trail):
    entry = trail.record_agent_action("Builder", "tailor_resume", {"user": "u1"}, {"status": "ok"})
    entry["action"] = "tampered"
    entry["outputs"]["status"] = "tampered"
    logs = trail.get_logs()
    logs[0]["agent_name"] = "tampered"
    stored = trail.get_logs("Builder")
    assert len(stored) == 1
    assert stored[0]["action"] == "tailor_resume"
    assert stored[0]["outputs"]["status"] == "ok"
    assert stored[0]["agent_name"] == "Builder"


def test_get_logs_full_and_filtered_return_independent_copies(trail):
    trail.record_agent_action("Builder", "a", {"u": "1"}, {"s": "ok"})
    trail.record_agent_action("Planner", "b", {"u": "2"}, {"s": "ok"})
    full = trail.get_logs()
    filtered = trail.get_logs("Planner")
    full[0]["agent_name"] = "mutated"
    assert len(trail.get_logs()) == 2
    assert trail.get_logs()[0]["agent_name"] == "Builder"
    assert filtered[0]["agent_name"] == "Planner"


def test_hmac_verifies_intact_entry(trail):
    entry = trail.record_agent_action("Builder", "tailor_resume", {"user": "u1"}, {"status": "ok"})
    assert INTEGRITY_FIELD in entry
    assert trail.verify_integrity(entry) is True


def test_hmac_detects_tampered_payload(trail):
    entry = trail.record_agent_action("Builder", "tailor_resume", {"user": "u1"}, {"status": "ok"})
    entry["outputs"]["status"] = "tampered"
    assert trail.verify_integrity(entry) is False


def test_hmac_detects_tampered_hmac_field(trail):
    entry = trail.record_agent_action("Builder", "tailor_resume", {"user": "u1"}, {"status": "ok"})
    entry[INTEGRITY_FIELD] = "0" * 64
    assert trail.verify_integrity(entry) is False


def test_verify_integrity_rejects_missing_or_invalid_hmac(trail):
    trail.record_agent_action("Builder", "tailor_resume", {"user": "u1"}, {"status": "ok"})
    assert trail.verify_integrity({"agent_name": "Builder"}) is False
    assert trail.verify_integrity("not-a-dict") is False


def test_entries_signed_with_distinct_keys_do_not_cross_verify():
    trail_a = AgentAuditTrail(hmac_key="key-a")
    trail_b = AgentAuditTrail(hmac_key="key-b")
    entry = trail_a.record_agent_action("Builder", "a", {"u": "1"}, {"s": "ok"})
    assert trail_b.verify_integrity(entry) is False
