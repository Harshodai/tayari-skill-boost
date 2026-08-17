from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.services.computer_action_policy import ComputerActionRejected, authorize_action
from app.services.computer_control import ComputerActionClass, ComputerActionRequest, ComputerGrant, ComputerMode, ComputerRunPolicy
from app.services.computer_grant_security import ComputerGrantReplayProtector, sign_grant


NOW = datetime.now(timezone.utc).replace(microsecond=0)
SECRET = "action-policy-secret-12345678901234567890"
ORIGIN = "https://jobs.example.test"
HASH = "b" * 64


def grant():
    return ComputerGrant(
        run_id=uuid4(),
        user_id=uuid4(),
        tenant_id=uuid4(),
        audience="tayari-browser-bridge",
        nonce="action-policy-nonce-123456",
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=5),
        mode=ComputerMode.LOCAL_BROWSER_BRIDGE,
        capability="workspace.local_browser_bridge",
        policy=ComputerRunPolicy(allowed_origins=(ORIGIN,), allowed_action_classes=(ComputerActionClass.READ, ComputerActionClass.NAVIGATION)),
        key_id="test-key",
    )


def action(g, action_class=ComputerActionClass.READ, kind="observe"):
    return ComputerActionRequest(
        run_id=g.run_id,
        grant_id=g.grant_id,
        action_class=action_class,
        kind=kind,
        document_generation=1,
        origin=ORIGIN,
        observation_sha256=HASH,
    )


@pytest.mark.asyncio
async def test_attached_grant_can_authorize_multiple_safe_actions():
    g = grant()
    signature = sign_grant(g, SECRET)
    protector = ComputerGrantReplayProtector(environment="development")
    first = await authorize_action(action(g), g, signature, expected_audience=g.audience, replay_protector=protector, secret=SECRET, now=NOW)
    second = await authorize_action(action(g), g, signature, expected_audience=g.audience, replay_protector=protector, secret=SECRET, now=NOW)
    assert first.status == "authorized_for_local_execution"
    assert second.status == "authorized_for_local_execution"


@pytest.mark.asyncio
async def test_sensitive_action_requires_confirmation_and_submission_is_blocked():
    g = grant().model_copy(update={"policy": ComputerRunPolicy(allowed_origins=(ORIGIN,), allowed_action_classes=(ComputerActionClass.READ, ComputerActionClass.SENSITIVE))})
    signature = sign_grant(g, SECRET)
    protector = ComputerGrantReplayProtector(environment="development")
    decision = await authorize_action(action(g, ComputerActionClass.SENSITIVE, "fill"), g, signature, expected_audience=g.audience, replay_protector=protector, secret=SECRET, now=NOW)
    assert decision.status == "confirmation_required"
    assert decision.requires_human_confirmation
    with pytest.raises(ComputerActionRejected, match="submission"):
        await authorize_action(action(g, ComputerActionClass.SUBMISSION, "click"), g, signature, expected_audience=g.audience, replay_protector=protector, secret=SECRET, now=NOW, human_confirmed=True)
