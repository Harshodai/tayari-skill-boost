from __future__ import annotations

import pytest

from app.services.checkpoint_store import compute_state_hash, verify_checkpoint_hash


def test_identical_states_hash_identically():
    assert compute_state_hash({"a": 1, "b": [1, 2]}) == compute_state_hash({"a": 1, "b": [1, 2]})


def test_key_order_irrelevant():
    assert compute_state_hash({"b": 1, "a": 2}) == compute_state_hash({"a": 2, "b": 1})


def test_state_change_changes_hash():
    assert compute_state_hash({"a": 1}) != compute_state_hash({"a": 2})
    assert compute_state_hash({"a": 1}) != compute_state_hash({"a": 1, "b": 2})


def test_verify_round_trip_idempotent():
    state = {"step": 3, "data": "x"}
    digest = compute_state_hash(state)
    assert verify_checkpoint_hash(state, digest) is True
    assert verify_checkpoint_hash(state, digest) is True
    assert verify_checkpoint_hash(state, digest.upper()) is True


def test_verify_rejects_tampered_state():
    digest = compute_state_hash({"a": 1})
    assert verify_checkpoint_hash({"a": 2}, digest) is False
    assert verify_checkpoint_hash({"a": 1}, "") is False


def test_non_dict_raises():
    with pytest.raises(ValueError):
        compute_state_hash(["not", "a", "dict"])


def test_hash_changes_on_change_property():
    pytest.importorskip("hypothesis", reason="pip install hypothesis for property tests")
    from hypothesis import given, settings, strategies as st

    json_scalar = st.one_of(
        st.text(max_size=30),
        st.integers(),
        st.booleans(),
        st.none(),
        st.floats(allow_nan=False, allow_infinity=False),
    )

    @given(st.dictionaries(st.text(min_size=1, max_size=15), json_scalar, max_size=6))
    @settings(max_examples=25, deadline=None)
    def inner(state):
        assert compute_state_hash(state) == compute_state_hash(dict(state))
        mutated = dict(state)
        mutated["__h8_new_key__"] = "__h8_new_value__"
        if "__h8_new_key__" not in state:
            assert compute_state_hash(mutated) != compute_state_hash(state)

    inner()


def test_identical_states_hash_identically_property():
    pytest.importorskip("hypothesis", reason="pip install hypothesis for property tests")
    from hypothesis import given, settings, strategies as st

    json_scalar = st.one_of(
        st.text(max_size=30),
        st.integers(),
        st.booleans(),
        st.none(),
        st.floats(allow_nan=False, allow_infinity=False),
    )

    @given(st.dictionaries(st.text(min_size=1, max_size=15), json_scalar, max_size=6))
    @settings(max_examples=25, deadline=None)
    def inner(state):
        reordered = dict(reversed(list(state.items())))
        assert compute_state_hash(state) == compute_state_hash(reordered)
        assert verify_checkpoint_hash(state, compute_state_hash(state)) is True

    inner()


def test_verify_idempotent_property():
    pytest.importorskip("hypothesis", reason="pip install hypothesis for property tests")
    from hypothesis import given, settings, strategies as st

    json_scalar = st.one_of(
        st.text(max_size=30),
        st.integers(),
        st.booleans(),
        st.none(),
        st.floats(allow_nan=False, allow_infinity=False),
    )

    @given(st.dictionaries(st.text(min_size=1, max_size=15), json_scalar, max_size=6))
    @settings(max_examples=25, deadline=None)
    def inner(state):
        digest = compute_state_hash(state)
        assert verify_checkpoint_hash(state, digest) is True
        assert verify_checkpoint_hash(state, digest) is True
        assert verify_checkpoint_hash(dict(state), digest) is True

    inner()
