from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.services.computer_control import ComputerGrant, ComputerMode, ComputerRunPolicy
from app.services.computer_grant_security import (
    ComputerGrantRejected,
    ComputerGrantReplayProtector,
    sign_grant,
    verify_grant,
)


NOW = datetime.now(timezone.utc).replace(microsecond=0)
SECRET = "bridge-secret-for-tests-12345678901234567890"


def make_grant(**updates):
    values = {
        "run_id": uuid4(),
        "user_id": uuid4(),
        "tenant_id": uuid4(),
        "audience": "tayari-browser-bridge-test",
        "nonce": "nonce-1234567890123456",
        "issued_at": NOW,
        "expires_at": NOW + timedelta(minutes=5),
        "mode": ComputerMode.LOCAL_BROWSER_BRIDGE,
        "capability": "workspace.local_browser_bridge",
        "policy": ComputerRunPolicy(allowed_origins=("https://jobs.example.test",)),
        "key_id": "test-key-v1",
    }
    values.update(updates)
    return ComputerGrant(**values)


@pytest.mark.asyncio
async def test_grant_detects_tampering_and_replay():
    grant = make_grant()
    signature = sign_grant(grant, SECRET)
    protector = ComputerGrantReplayProtector(environment="development")

    await verify_grant(
        grant,
        signature,
        expected_audience="tayari-browser-bridge-test",
        replay_protector=protector,
        secret=SECRET,
        now=NOW,
    )
    with pytest.raises(ComputerGrantRejected, match="already been used"):
        await verify_grant(
            grant,
            signature,
            expected_audience="tayari-browser-bridge-test",
            replay_protector=protector,
            secret=SECRET,
            now=NOW,
        )

    with pytest.raises(ComputerGrantRejected, match="invalid computer grant signature"):
        await verify_grant(
            grant.model_copy(update={"nonce": "tampered-nonce-1234567890"}),
            signature,
            expected_audience="tayari-browser-bridge-test",
            replay_protector=ComputerGrantReplayProtector(environment="development"),
            secret=SECRET,
            now=NOW,
        )


@pytest.mark.asyncio
async def test_grant_rejects_audience_and_expiry():
    grant = make_grant()
    signature = sign_grant(grant, SECRET)
    with pytest.raises(ComputerGrantRejected, match="audience"):
        await verify_grant(
            grant,
            signature,
            expected_audience="another-bridge",
            secret=SECRET,
            now=NOW,
        )
    with pytest.raises(ComputerGrantRejected, match="expired"):
        await verify_grant(
            grant.model_copy(update={"expires_at": NOW - timedelta(seconds=1)}),
            signature,
            expected_audience=grant.audience,
            secret=SECRET,
            now=NOW,
        )


@pytest.mark.asyncio
async def test_staging_requires_durable_replay_protection():
    grant = make_grant()
    signature = sign_grant(grant, SECRET)
    with pytest.raises(ComputerGrantRejected, match="requires Redis"):
        await verify_grant(
            grant,
            signature,
            expected_audience=grant.audience,
            replay_protector=ComputerGrantReplayProtector(redis_url=None, environment="staging"),
            secret=SECRET,
            now=NOW,
        )
