"""Duplex-voice fail-closed seam — no live audio asserted, no network touched."""
import os


def test_no_keys_returns_unavailable_shape(monkeypatch):
    from app.services import voice_live

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    res = voice_live.start_live_session("u1", "r1")
    assert res["status"] == "unavailable"
    assert res["reason"] == "voice_live_not_configured"
    assert res["required_env"] == ["GEMINI_API_KEY or OPENAI_API_KEY"]


def test_keys_present_returns_ready_without_network(monkeypatch):
    from app.services import voice_live

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    res = voice_live.start_live_session("u1", "r1")
    assert res["status"] == "ready"
    assert "endpoint" in res


def test_duplex_protocol_is_explicit_stub():
    from app.services import voice_live

    try:
        voice_live.connect_live_session("u1", "r1")
    except NotImplementedError:
        return
    raise AssertionError("expected NotImplementedError")
