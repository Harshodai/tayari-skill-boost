from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

import app.api.computer_routes as computer_routes
from app.api.computer_routes import ComputerObservationRecordRequest
from app.services.computer_action_policy import ComputerActionRejected, authorize_action
from app.services.computer_control import ComputerActionClass, ComputerActionRequest, ComputerGrant, ComputerMode, ComputerRunPolicy
from app.services.computer_grant_security import ComputerGrantReplayProtector, sign_grant


NOW = datetime.now(timezone.utc).replace(microsecond=0)
SECRET = "security-regression-secret-12345678901234567890"
ORIGIN = "https://jobs.example.test"
OTHER_ORIGIN = "https://evil.example.test"
HASH = "c" * 64


def _grant(*, origin: str = ORIGIN) -> ComputerGrant:
    return ComputerGrant(
        run_id=uuid4(),
        user_id=uuid4(),
        tenant_id=uuid4(),
        audience="tayari-browser-bridge",
        nonce="security-regression-nonce-123456",
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=5),
        mode=ComputerMode.LOCAL_BROWSER_BRIDGE,
        capability="workspace.local_browser_bridge",
        policy=ComputerRunPolicy(allowed_origins=(ORIGIN,), allowed_action_classes=(ComputerActionClass.READ, ComputerActionClass.NAVIGATION)),
        key_id="test-key",
    )


def _action(grant: ComputerGrant, *, origin: str = ORIGIN, action_class: ComputerActionClass = ComputerActionClass.READ, kind: str = "observe") -> ComputerActionRequest:
    return ComputerActionRequest(
        run_id=grant.run_id,
        grant_id=grant.grant_id,
        action_class=action_class,
        kind=kind,
        document_generation=1,
        origin=origin,
        observation_sha256=HASH,
    )


@pytest.mark.asyncio
async def test_origin_switch_is_rejected_before_action_execution():
    grant = _grant()
    with pytest.raises(ComputerActionRejected, match="outside the signed policy"):
        await authorize_action(
            _action(grant, origin=OTHER_ORIGIN),
            grant,
            sign_grant(grant, SECRET),
            expected_audience=grant.audience,
            replay_protector=ComputerGrantReplayProtector(environment="development"),
            secret=SECRET,
            now=NOW,
        )


def test_page_content_cannot_expand_action_scope_with_privileged_parameters():
    grant = _grant()
    with pytest.raises(ValueError, match="privileged"):
        ComputerActionRequest(
            run_id=grant.run_id,
            grant_id=grant.grant_id,
            action_class=ComputerActionClass.READ,
            kind="observe",
            document_generation=1,
            origin=ORIGIN,
            observation_sha256=HASH,
            params={"javascript": "submit()"},
        )


def test_capability_disabled_gate_is_stable_423(monkeypatch):
    monkeypatch.setenv("CAPABILITY_WORKSPACE_ISOLATED_COMPUTER", "false")
    with pytest.raises(HTTPException) as exc:
        computer_routes._require_matching_capability(ComputerMode.ISOLATED, "workspace.isolated_computer")
    assert exc.value.status_code == 423
    assert exc.value.detail["code"] == "disabled_by_launch_scope"


@pytest.mark.asyncio
async def test_submission_is_permanently_fail_closed():
    grant = _grant().model_copy(update={"policy": ComputerRunPolicy(allowed_origins=(ORIGIN,), allowed_action_classes=(ComputerActionClass.READ, ComputerActionClass.SUBMISSION))})
    with pytest.raises(ComputerActionRejected, match="submission"):
        await authorize_action(
            _action(grant, action_class=ComputerActionClass.SUBMISSION, kind="click"),
            grant,
            sign_grant(grant, SECRET),
            expected_audience=grant.audience,
            replay_protector=ComputerGrantReplayProtector(environment="development"),
            secret=SECRET,
            now=NOW,
            human_confirmed=True,
        )


@pytest.mark.asyncio
async def test_observation_url_origin_switch_is_rejected_before_persistence(monkeypatch):
    grant = _grant()
    class Connection:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return None
        async def execute(self, *args):
            raise AssertionError("origin-switched observation must not persist")
    class Pool:
        def acquire(self):
            return Connection()
    async def pool():
        return Pool()
    monkeypatch.setattr(computer_routes, "get_pool", pool)
    monkeypatch.setattr(computer_routes, "verify_grant", lambda *args, **kwargs: None)
    payload = ComputerObservationRecordRequest(
        grant=grant.model_dump(mode="json"),
        signature=sign_grant(grant, SECRET),
        observation_id=uuid4(),
        document_generation=1,
        origin=ORIGIN,
        url=f"{OTHER_ORIGIN}/jobs/1",
        content_sha256=HASH,
    )
    context = SimpleNamespace(subject=str(grant.user_id), tenant_id=str(grant.tenant_id))
    with pytest.raises(HTTPException) as exc:
        await computer_routes.record_computer_observation(grant.run_id, payload, context)
    assert exc.value.status_code == 403
    assert "origin" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_get_run_owner_and_tenant_predicates_block_foreign_run(monkeypatch):
    calls = []

    class Connection:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def fetchrow(self, query, *args):
            calls.append((query, args))
            return None

    class Pool:
        def acquire(self):
            return Connection()

    async def pool():
        return Pool()

    monkeypatch.setattr(computer_routes, "get_pool", pool)
    context = SimpleNamespace(subject=str(uuid4()), tenant_id=str(uuid4()))
    with pytest.raises(HTTPException) as exc:
        await computer_routes.get_computer_run(uuid4(), context)
    assert exc.value.status_code == 404
    query, args = calls[0]
    assert "user_id = $2" in query and "tenant_id = $3" in query
    assert len(args) == 3
