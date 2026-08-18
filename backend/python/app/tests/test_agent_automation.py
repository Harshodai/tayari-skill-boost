from __future__ import annotations

import pytest

from app.services.capabilities import Capability
from app.tasks.agent_automation import action_hash, token_digest


def test_action_hash_is_stable_and_payload_bound():
    first = action_hash("draft_email", "external_write", "Review", {"body": "one"}, "v1")
    same = action_hash("draft_email", "external_write", "Review", {"body": "one"}, "v1")
    changed = action_hash("draft_email", "external_write", "Review", {"body": "two"}, "v1")
    assert first == same
    assert first != changed
    assert len(first) == 64


def test_token_digest_is_not_the_raw_token():
    token = "a" * 64
    digest = token_digest(token)
    assert digest != token
    assert len(digest) == 64


def test_submission_is_not_an_automation_risk_path():
    assert Capability.AUTONOMOUS_ATS_SUBMIT.value == "autonomous.ats_submit"


@pytest.mark.asyncio
async def test_dispatch_is_disabled_in_production_without_capability(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CAPABILITY_WORKSPACE_AUTOMATIONS", raising=False)
    from app.tasks import agent_automation

    result = await agent_automation._dispatch()
    assert result == {"status": "disabled_by_launch_scope", "expired": 0, "claimed": 0}
