from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.services.computer_control import (
    ComputerActionClass,
    ComputerActionRequest,
    ComputerMode,
    ComputerRun,
    ComputerRunPolicy,
    action_allowed,
    origin_allowed,
)


ORIGIN = "https://jobs.example.test"
HASH = "a" * 64


def test_policy_normalizes_origins_and_rejects_loopback():
    policy = ComputerRunPolicy(allowed_origins=(f"{ORIGIN}/", ORIGIN))
    assert policy.allowed_origins == (ORIGIN,)
    assert origin_allowed(ORIGIN, policy)
    assert not origin_allowed("https://other.example.test", policy)

    with pytest.raises(ValidationError):
        ComputerRunPolicy(allowed_origins=("http://127.0.0.1:9222",))


def test_submission_is_fail_closed_even_when_requested():
    with pytest.raises(ValidationError):
        ComputerRunPolicy(submission_enabled=True)


def test_run_rejects_unknown_capability():
    with pytest.raises(ValidationError):
        ComputerRun(
            user_id=uuid4(),
            tenant_id=uuid4(),
            mode=ComputerMode.LOCAL_BROWSER_BRIDGE,
            capability="autonomous.browser",
        )


def test_action_rejects_cookie_storage_and_shell_parameters():
    for key in ("cookies", "local_storage", "password", "javascript", "command"):
        with pytest.raises(ValidationError):
            ComputerActionRequest(
                run_id=uuid4(),
                grant_id=uuid4(),
                action_class=ComputerActionClass.READ,
                kind="observe",
                document_generation=1,
                origin=ORIGIN,
                observation_sha256=HASH,
                params={key: "forbidden"},
            )


def test_action_policy_requires_current_allowed_origin_and_class():
    policy = ComputerRunPolicy(
        allowed_origins=(ORIGIN,),
        allowed_action_classes=(ComputerActionClass.READ, ComputerActionClass.NAVIGATION),
    )
    action = ComputerActionRequest(
        run_id=uuid4(),
        grant_id=uuid4(),
        action_class=ComputerActionClass.READ,
        kind="observe",
        document_generation=1,
        origin=ORIGIN,
        observation_sha256=HASH,
    )
    assert action_allowed(action, policy)
    assert not action_allowed(action.model_copy(update={"origin": "https://evil.example.test"}), policy)
    assert not action_allowed(
        action.model_copy(update={"action_class": ComputerActionClass.SENSITIVE}),
        policy,
    )


def test_release_and_stop_are_allowed_without_page_origin():
    policy = ComputerRunPolicy(allowed_origins=(ORIGIN,))
    action = ComputerActionRequest(
        run_id=uuid4(),
        grant_id=uuid4(),
        action_class=ComputerActionClass.READ,
        kind="stop",
        document_generation=1,
        origin=ORIGIN,
        observation_sha256=HASH,
    )
    assert action_allowed(action, policy)
