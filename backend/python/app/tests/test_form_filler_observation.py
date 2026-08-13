"""Form-filler observation must fail closed.

Regression cover for the defect where a silently-failed accessibility snapshot
produced an empty node list, which `classify_fields` turned into zero questions,
which reported `needs_human: False` — the all-clear — precisely when the agent
could not see the form at all. Sponsorship, salary, and veteran-status fields
stopped being escalated to the human exactly when escalation mattered most.
"""
from __future__ import annotations

from app.agent.browser_operator import BrowserOperator
from app.services.form_filler import FormFiller
from app.services.question_queue import classify_fields


def _filler() -> FormFiller:
    """A FormFiller with no browser — only the pure parsing helpers are used."""
    return FormFiller.__new__(FormFiller)


def _parse(tree: str):
    """Parse via BrowserOperator's real tree reader, dropping the disambiguation index.

    `BrowserOperator._parse_accessibility_tree` is what `observe()` actually
    calls in production. `form_filler.py` used to carry its own duplicate
    parser purely so it could be unit-tested in isolation — that parser was
    never on the live fill path (`execute_form_auto_fill` only ever calls
    `self.browser.observe()`) and has been deleted. These tests now exercise
    the parser that is actually reachable at runtime.
    """
    return [{"role": e["role"], "name": e["name"]} for e in BrowserOperator._parse_accessibility_tree(tree)]


class TestAriaSnapshotParser:
    """`Locator.aria_snapshot()` is the reader `BrowserOperator.observe()` uses."""

    def test_extracts_role_and_accessible_name(self):
        nodes = _parse(
            '- textbox "First Name"\n'
            '- combobox "Are you legally authorized to work?"\n'
        )
        assert nodes == [
            {"role": "textbox", "name": "First Name"},
            {"role": "combobox", "name": "Are you legally authorized to work?"},
        ]

    def test_ignores_non_input_roles(self):
        nodes = _parse(
            '- paragraph: some prose\n'
            '- heading "Apply now"\n'
            '- textbox "Email"\n'
        )
        assert nodes == [{"role": "textbox", "name": "Email"}]

    def test_handles_trailing_colon_and_nested_children(self):
        nodes = _parse(
            '- button "Submit Application":\n'
            '  - text: Submit\n'
        )
        assert nodes == [{"role": "button", "name": "Submit Application"}]

    def test_unnamed_input_still_reported(self):
        assert _parse("- textbox\n") == [{"role": "textbox", "name": ""}]

    def test_empty_snapshot_yields_no_nodes(self):
        assert _parse("") == []

    def test_disambiguates_repeated_role_and_name_by_order(self):
        """Two identically-labelled fields must not collide on the same ref.

        `observe()` binds each element to `get_by_role(role, name=name).nth(index)`
        — this is the index that disambiguation, so it has to increment per
        repeat rather than resetting or coinciding.
        """
        elements = BrowserOperator._parse_accessibility_tree(
            '- textbox "Email"\n'
            '- textbox "Email"\n'
        )
        assert [e["index"] for e in elements] == [0, 1]


class TestSensitiveFieldEscalation:
    """The nodes the parser produces must actually reach the human queue."""

    def test_sensitive_fields_are_queued_for_a_human(self):
        nodes = _parse(
            '- combobox "Are you legally authorized to work?"\n'
            '- checkbox "Veteran status"\n'
            '- textbox "Desired salary"\n'
            '- textbox "First Name"\n'
        )
        labels = {q["field_label"] for q in classify_fields(nodes, filled_labels=set())}

        assert "Are you legally authorized to work?" in labels
        assert "Veteran status" in labels
        assert "Desired salary" in labels

    def test_blind_run_produces_no_questions(self):
        """The root of the defect: an unobserved form looks like a clean one.

        classify_fields cannot distinguish "no sensitive fields" from "no
        observation", so `needs_human` must NOT be derived from it alone —
        execute_form_auto_fill ORs in its observation_error for this reason.
        """
        assert classify_fields([], filled_labels=set()) == []

import pytest
from app.services import form_filler as form_filler_module


class _ObservedBrowser:
    """Small BrowserOperator double that records only ref-based fill calls."""

    page = object()

    def __init__(self, elements):
        self._elements = elements
        self.fill_calls = []

    async def navigate(self, *_args, **_kwargs):
        return {"success": True}

    async def observe(self):
        return {"success": True, "elements": self._elements}

    async def fill(self, target, value):
        self.fill_calls.append((target, value))
        return {"success": True}


async def _no_answers(_user_id):
    return {}


async def _no_enqueue(_questions, **_kwargs):
    return 0


def _observed_filler(elements):
    filler = FormFiller.__new__(FormFiller)
    filler.browser = _ObservedBrowser(elements)
    return filler


@pytest.mark.asyncio
async def test_form_fill_uses_observed_ref_not_a_reconstructed_selector(monkeypatch):
    """The fill target is the BrowserOperator ref returned by observe()."""
    filler = _observed_filler([
        {"ref": "ref_1", "role": "button", "name": "Apply"},
        {"ref": "ref_2", "role": "textbox", "name": "Full name"},
    ])
    monkeypatch.setattr(
        form_filler_module,
        "_resolve_and_validate_url",
        lambda url: {"target_url": url, "headers": {}},
    )
    monkeypatch.setattr(form_filler_module, "pending_answers", _no_answers)
    monkeypatch.setattr(form_filler_module, "enqueue_questions", _no_enqueue)

    result = await filler.execute_form_auto_fill(
        "https://example.com/apply",
        {"name": "Ada Lovelace"},
    )

    assert result["success"] is True
    assert filler.browser.fill_calls == [("ref_2", "Ada Lovelace")]
    assert all(target.startswith("ref_") for target, _value in filler.browser.fill_calls)


@pytest.mark.asyncio
async def test_form_fill_fails_closed_when_observation_has_no_valid_ref(monkeypatch):
    """An unaddressable observation must never fall back to CSS selector matching."""
    filler = _observed_filler([
        {"ref": "input[aria-label*=name]", "role": "textbox", "name": "Full name"},
    ])
    monkeypatch.setattr(
        form_filler_module,
        "_resolve_and_validate_url",
        lambda url: {"target_url": url, "headers": {}},
    )
    monkeypatch.setattr(form_filler_module, "pending_answers", _no_answers)
    monkeypatch.setattr(form_filler_module, "enqueue_questions", _no_enqueue)

    result = await filler.execute_form_auto_fill(
        "https://example.com/apply",
        {"name": "Ada Lovelace"},
    )

    assert result["success"] is False
    assert result["observation_failed"] is True
    assert result["needs_human"] is True
    assert filler.browser.fill_calls == []


@pytest.mark.asyncio
async def test_saved_sensitive_answer_uses_observed_ref(monkeypatch):
    """Previously approved human answers keep the same ref-only guarantee."""
    filler = _observed_filler([
        {"ref": "ref_7", "role": "textbox", "name": "Desired salary"},
    ])

    async def _saved_answer(_user_id):
        return {"desired salary": "120000"}

    monkeypatch.setattr(
        form_filler_module,
        "_resolve_and_validate_url",
        lambda url: {"target_url": url, "headers": {}},
    )
    monkeypatch.setattr(form_filler_module, "pending_answers", _saved_answer)
    monkeypatch.setattr(form_filler_module, "enqueue_questions", _no_enqueue)

    result = await filler.execute_form_auto_fill(
        "https://example.com/apply",
        {"name": "Ada Lovelace"},
    )

    assert result["success"] is True
    assert filler.browser.fill_calls == [("ref_7", "120000")]
    assert "Desired salary" in result["actions_executed"][0]
