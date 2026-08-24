import pytest

from app.telemetry import product_events


def test_product_event_hashes_identity_and_emits_only_safe_properties(monkeypatch):
    captured = {}
    monkeypatch.setattr(product_events, "publish_event", lambda *args, **kwargs: captured.update(args=args, kwargs=kwargs))
    event_id = product_events.record_product_event(
        "first_useful_result",
        user_id="user-123",
        properties={"entry_point": "resume", "latency_ms": 42.5},
    )
    assert event_id
    payload = captured["kwargs"]["payload"]
    assert payload["actor_hash"] != "user-123"
    assert payload["properties"] == {"entry_point": "resume", "latency_ms": 42.5}


def test_product_event_rejects_synthetic_identity_and_sensitive_properties():
    with pytest.raises(product_events.ProductEventError):
        product_events.record_product_event("signup_completed", user_id="default_user")
    with pytest.raises(product_events.ProductEventError):
        product_events.record_product_event(
            "review_completed",
            user_id="user-123",
            properties={"resume_text": "private content"},
        )


def test_product_event_rejects_unknown_event_and_unbounded_properties():
    with pytest.raises(product_events.ProductEventError):
        product_events.record_product_event("made_up_event", user_id="user-123")
    with pytest.raises(product_events.ProductEventError):
        product_events.record_product_event(
            "application_tracked",
            user_id="user-123",
            properties={"status": "x" * 121},
        )
