"""PII scrubber unit tests — phone/SSN/email/address redaction."""
from __future__ import annotations

from app.services.pii_scrubber import scrub

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import llm_service
from app.services.llm_service import DailyCostTracker


def test_scrub_phone():
    text = "Call me at (415) 555-0132 tomorrow"
    scrubbed, fields = scrub(text)
    assert fields == ["phone"]
    assert "415" not in scrubbed
    assert "[PHONE]" in scrubbed


def test_scrub_ssn():
    text = "SSN 123-45-6789 on file"
    scrubbed, fields = scrub(text)
    assert fields == ["ssn"]
    assert "123-45-6789" not in scrubbed
    assert "[SSN]" in scrubbed


def test_scrub_email():
    text = "Reach me at jane.doe@gmail.com please"
    scrubbed, fields = scrub(text)
    assert fields == ["email"]
    assert "jane.doe@gmail.com" not in scrubbed
    assert "[EMAIL]" in scrubbed


def test_scrub_address():
    text = "Lives at 123 Main Street, Springfield"
    scrubbed, fields = scrub(text)
    assert fields == ["address"]
    assert "123 Main Street" not in scrubbed
    assert "[ADDRESS]" in scrubbed


def test_no_false_positive_on_skill_text():
    text = "Senior Python engineer, FastAPI and React, led team of 5, improved latency 20%"
    scrubbed, fields = scrub(text)
    assert fields == []
    assert scrubbed == text


def test_scrub_returns_types_not_values():
    text = "Email jane.doe@gmail.com phone 415-555-0132"
    scrubbed, fields = scrub(text)
    assert sorted(fields) == ["email", "phone"]
    assert "jane.doe@gmail.com" not in scrubbed
    assert "415-555-0132" not in scrubbed
    for f in fields:
        assert "@" not in f


def test_record_cost_rejects_falsy_user_id():
    tracker = DailyCostTracker()
    with pytest.raises(ValueError):
        tracker.record_cost(0.01, None)
    with pytest.raises(ValueError):
        tracker.record_cost(0.01, "")
    with pytest.raises(ValueError):
        tracker.record_cost(0.01, "   ")


def test_record_cost_tracks_per_user():
    tracker = DailyCostTracker()
    total1, exceeded1, limit1 = tracker.record_cost(0.01, "u1")
    assert isinstance(total1, float)
    assert isinstance(exceeded1, bool)
    assert isinstance(limit1, float)
    total2, _, _ = tracker.record_cost(0.01, "u1")
    assert total2 > total1
    total_other, _, _ = tracker.record_cost(0.01, "u2")
    assert total_other == pytest.approx(0.01)


@pytest.mark.asyncio
async def test_llm_complete_scrubs_system_and_user_message():
    raw_email = "hr@example.com"
    raw_phone = "(415) 555-0132"
    captured = {}

    async def fake_complete(system_message, user_message, max_tokens=800, temperature=0.3):
        captured["system"] = system_message
        captured["user"] = user_message
        return "ok"

    mock_provider = MagicMock()
    mock_provider.active_engine_label.return_value = "fake"
    mock_provider.complete = fake_complete

    with patch.object(llm_service, "build_provider", return_value=mock_provider):
        result = await llm_service.llm_complete(
            f"Contact {raw_email} for details",
            f"Call me at {raw_phone} tomorrow",
            _user_id="u1",
        )

    assert result == "ok"
    assert raw_email not in captured["system"]
    assert "[EMAIL]" in captured["system"]
    assert raw_phone not in captured["user"]
    assert "[PHONE]" in captured["user"]


@pytest.mark.asyncio
async def test_llm_complete_anon_user_id_fails_open():
    mock_provider = MagicMock()
    mock_provider.active_engine_label.return_value = "fake"
    mock_provider.complete = AsyncMock(return_value="anon ok")

    with patch.object(llm_service, "build_provider", return_value=mock_provider):
        result = await llm_service.llm_complete("sys", "user", _user_id=None)

    assert result == "anon ok"
