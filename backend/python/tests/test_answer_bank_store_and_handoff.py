from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.services import answer_bank_store
from app.services.db import ALLOWED_HITL_TRANSITIONS


class _Acquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Pool:
    def __init__(self, version_row, rows):
        self.version_row = version_row
        self.rows = rows

    def acquire(self):
        return _Acquire(self)

    async def fetchrow(self, query, *args):
        return self.version_row

    async def fetch(self, query, *args):
        return self.rows


@pytest.mark.asyncio
async def test_sensitive_answer_is_not_reused_without_current_application(monkeypatch):
    version_row = {
        "id": "version-1",
        "version": 1,
        "application_id": "application-a",
        "confirmed_at": datetime.now(timezone.utc),
        "expires_at": None,
    }
    rows = [
        {
            "field_key": "work_authorization",
            "value": "Authorized",
            "sensitivity_class": "legal",
            "provenance_type": "user_entered",
            "provenance_ref": "application-a",
            "answer_hash": "hash",
            "confirmed_for_application": True,
            "expires_at": None,
        },
        {
            "field_key": "work_preference",
            "value": "Remote",
            "sensitivity_class": "ordinary",
            "provenance_type": "user_entered",
            "provenance_ref": None,
            "answer_hash": "hash",
            "confirmed_for_application": False,
            "expires_at": None,
        },
    ]
    async def fake_get_pool():
        return _Pool(version_row, rows)

    monkeypatch.setattr(answer_bank_store, "get_pool", fake_get_pool)

    snapshot = await answer_bank_store.load_candidate_answer_snapshot(
        "user-a", application_id="application-b"
    )

    assert "work_authorization" not in snapshot.answers
    assert snapshot.answers["work_preference"] == "Remote"
    assert "work_authorization" in snapshot.unresolved_sensitive_fields


@pytest.mark.asyncio
async def test_synthetic_identity_is_rejected(monkeypatch):
    async def fake_get_pool():
        return None

    monkeypatch.setattr(answer_bank_store, "get_pool", fake_get_pool)
    with pytest.raises(ValueError):
        await answer_bank_store.load_candidate_answer_snapshot("default_user")


def test_preparing_can_enter_every_supported_handoff_state():
    expected = {
        "needs_browser_handoff",
        "needs_user_login",
        "needs_otp_or_mfa",
        "needs_captcha",
        "needs_terms_review",
        "needs_sensitive_answer",
    }
    assert expected.issubset(ALLOWED_HITL_TRANSITIONS["preparing"])
