from types import SimpleNamespace

import pytest

from app.services.browser_automation.agent import PromptInjectionBlocked, _guard_untrusted_actions


START_URL = "https://jobs.example.test/apply/1"


class Action:
    def __init__(self, payload):
        self.payload = payload

    def model_dump(self, exclude_none=True):
        return self.payload


class Node:
    def __init__(self, label, node_type="text"):
        self.attributes = {"aria-label": label, "type": node_type}


def state_for(label="Email"):
    return SimpleNamespace(
        url=START_URL,
        selector_map={1: Node(label)},
    )


def output_for(payload):
    return SimpleNamespace(action=[Action(payload)])


def assert_blocked(state, payload):
    with pytest.raises(PromptInjectionBlocked):
        _guard_untrusted_actions(state, output_for(payload), START_URL, [])


def test_injection_cannot_navigate_to_attacker_origin():
    assert_blocked(state_for(), {"go_to_url": {"url": "https://attacker.example/exfiltrate"}})


def test_injection_cannot_upload_file_from_page_instruction():
    assert_blocked(state_for(), {"upload_file": {"path": "/tmp/customer-resume.pdf"}})


def test_injection_cannot_mutate_unknown_sensitive_field():
    assert_blocked(state_for("Social Security Number"), {"input_text": {"index": 1, "text": "123-45-6789"}})


def test_injection_cannot_submit_without_server_guard():
    assert_blocked(state_for("Apply now"), {"click_element": {"index": 1}})
    assert_blocked(state_for(), {"submit_application": {}})


def test_allowed_application_field_is_not_blocked_by_page_text():
    _guard_untrusted_actions(
        state_for("Email"),
        output_for({"input_text": {"index": 1, "text": "synthetic@example.test"}}),
        START_URL,
        [],
    )
