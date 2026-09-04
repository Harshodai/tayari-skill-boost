"""Track A: multi-board computer policy (flagged)."""
import pytest

from app.services.browser_worker_pool import (
    DomainForbiddenError,
    board_handoff_for_url,
    validate_ats_url,
)
from app.services.computer_action_policy import BOARD_POLICIES, authorize_board


def test_board_policies_table():
    assert BOARD_POLICIES["boards.greenhouse.io"]["enabled"] is True
    assert BOARD_POLICIES["boards.lever.co"]["enabled"] is False
    assert BOARD_POLICIES["jobs.ashbyhq.com"]["enabled"] is False


def test_unknown_board_rejected():
    with pytest.raises(DomainForbiddenError):
        validate_ats_url("https://evil.example.com/j/1")
    with pytest.raises(DomainForbiddenError):
        authorize_board("https://evil.example.com/j/1")


def test_greenhouse_allowed():
    url = "https://boards.greenhouse.io/acme/jobs/12345"
    assert validate_ats_url(url) == url
    decision = authorize_board(url)
    assert decision["outcome"] == "allow"
    assert board_handoff_for_url(url) is None


@pytest.mark.parametrize(
    "url",
    [
        "https://boards.lever.co/acme/12345",
        "https://jobs.ashbyhq.com/acme/12345",
    ],
)
def test_disabled_boards_return_board_disabled_handoff(url):
    decision = authorize_board(url)
    assert decision["outcome"] == "handoff"
    assert decision["reason"] == "board_disabled"
    handoff = board_handoff_for_url(url)
    assert handoff is not None
    assert handoff["reason"] == "board_disabled"


@pytest.mark.asyncio
async def test_disabled_board_never_executes():
    from app.services.browser_worker_pool import create_worker, get_worker

    run_id = "board-disabled-never-executes"
    assert get_worker(run_id) is None
    with pytest.raises(DomainForbiddenError) as exc_info:
        await create_worker(
            run_id=run_id,
            user_id="00000000-0000-0000-0000-000000000001",
            target_url="https://boards.lever.co/acme/12345",
        )
    assert "board_disabled" in exc_info.value.detail
    assert get_worker(run_id) is None


@pytest.mark.asyncio
async def test_submit_block_unchanged():
    from datetime import datetime, timedelta, timezone
    from uuid import uuid4

    from app.services.computer_action_policy import ComputerActionRejected, authorize_action
    from app.services.computer_control import (
        ComputerActionClass,
        ComputerActionRequest,
        ComputerGrant,
        ComputerMode,
        ComputerRunPolicy,
    )
    from app.services.computer_grant_security import ComputerGrantReplayProtector, sign_grant

    now = datetime.now(timezone.utc).replace(microsecond=0)
    secret = "board-policy-submit-block-secret-1234567890"
    origin = "https://jobs.example.test"
    grant = ComputerGrant(
        run_id=uuid4(),
        user_id=uuid4(),
        tenant_id=uuid4(),
        audience="tayari-browser-bridge",
        nonce="board-policy-nonce-123456",
        issued_at=now,
        expires_at=now + timedelta(minutes=5),
        mode=ComputerMode.LOCAL_BROWSER_BRIDGE,
        capability="workspace.local_browser_bridge",
        policy=ComputerRunPolicy(
            allowed_origins=(origin,),
            allowed_action_classes=(ComputerActionClass.READ, ComputerActionClass.SUBMISSION),
        ),
        key_id="test-key",
    )
    action = ComputerActionRequest(
        run_id=grant.run_id,
        grant_id=grant.grant_id,
        action_class=ComputerActionClass.SUBMISSION,
        kind="click",
        document_generation=1,
        origin=origin,
        observation_sha256="d" * 64,
    )
    with pytest.raises(ComputerActionRejected, match="submission"):
        await authorize_action(
            action,
            grant,
            sign_grant(grant, secret),
            expected_audience=grant.audience,
            replay_protector=ComputerGrantReplayProtector(environment="development"),
            secret=secret,
            now=now,
            human_confirmed=True,
        )
