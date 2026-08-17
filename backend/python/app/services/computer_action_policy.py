"""Policy gate for bounded local-browser computer actions."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.services.computer_control import ComputerActionClass, ComputerActionRequest, ComputerGrant, ComputerRunPolicy, action_allowed
from app.services.computer_grant_security import ComputerGrantRejected, ComputerGrantReplayProtector, verify_grant


class ComputerActionRejected(RuntimeError):
    pass


@dataclass(frozen=True)
class ActionDecision:
    action_id: str
    status: str
    requires_human_confirmation: bool = False


async def authorize_action(
    action: ComputerActionRequest,
    grant: ComputerGrant,
    signature: str,
    *,
    expected_audience: str,
    replay_protector: ComputerGrantReplayProtector,
    secret: str | None = None,
    human_confirmed: bool = False,
    now: datetime | None = None,
) -> ActionDecision:
    if action.run_id != grant.run_id or action.grant_id != grant.grant_id:
        raise ComputerActionRejected("action is not bound to the signed grant")
    try:
        await verify_grant(
            grant,
            signature,
            expected_audience=expected_audience,
            replay_protector=replay_protector,
            secret=secret,
            now=now,
            consume_nonce=False,
        )
    except ComputerGrantRejected as exc:
        raise ComputerActionRejected("computer action grant rejected") from exc
    if action.action_class is ComputerActionClass.SUBMISSION:
        raise ComputerActionRejected("computer submission is disabled")
    if not action_allowed(action, grant.policy):
        if action.action_class is ComputerActionClass.SENSITIVE and not human_confirmed:
            return ActionDecision(str(action.action_id), "confirmation_required", True)
        raise ComputerActionRejected("computer action is outside the signed policy")
    if action.action_class is ComputerActionClass.SENSITIVE and not human_confirmed:
        return ActionDecision(str(action.action_id), "confirmation_required", True)
    return ActionDecision(str(action.action_id), "authorized_for_local_execution")
