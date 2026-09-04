"""Policy gate for bounded local-browser computer actions."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlsplit

from app.services.computer_control import ComputerActionClass, ComputerActionRequest, ComputerGrant, ComputerRunPolicy, action_allowed
from app.services.computer_grant_security import ComputerGrantRejected, ComputerGrantReplayProtector, verify_grant


BOARD_POLICIES: dict[str, dict[str, bool]] = {
    "boards.greenhouse.io": {"enabled": True},
    "boards.lever.co": {"enabled": False},
    "jobs.ashbyhq.com": {"enabled": False},
}


def _board_host_for_url(url: str) -> str:
    from app.services.browser_worker_pool import DomainForbiddenError  # ponytail: lazy import; worker_pool imports BOARD_POLICIES at top so a top-level import here would cycle

    if not url or not isinstance(url, str):
        raise DomainForbiddenError("Forbidden: URL is missing or invalid.")
    clean = url.strip()
    if "://" not in clean:
        clean = f"https://{clean}"
    try:
        parsed = urlsplit(clean)
        host = (parsed.hostname or "").strip().lower().rstrip(".")
    except Exception as exc:
        raise DomainForbiddenError(f"Forbidden: Malformed URL: {exc}")
    if parsed.scheme not in ("http", "https"):
        raise DomainForbiddenError(
            f"Forbidden: URL scheme '{parsed.scheme}' is not allowed. Only http/https are permitted."
        )
    if not host:
        raise DomainForbiddenError("Forbidden: URL is missing or invalid.")
    return host


def authorize_board(url: str) -> dict[str, str]:
    from app.services.browser_worker_pool import DomainForbiddenError  # ponytail: same cycle avoidance as above

    host = _board_host_for_url(url)
    policy = BOARD_POLICIES.get(host)
    if policy is None:
        raise DomainForbiddenError(
            f"Forbidden: ATS domain '{host}' is not allowlisted. "
            f"Only {sorted(BOARD_POLICIES)} are known boards."
        )
    if not policy.get("enabled", False):
        return {"outcome": "handoff", "reason": "board_disabled", "host": host}
    return {"outcome": "allow", "host": host}


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
