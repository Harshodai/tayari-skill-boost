"""Tayari Computer control-plane routes.

The gateway must supply a verified subject/tenant binding. These endpoints do
not accept caller-selected identity or tenant headers from direct callers.
"""
from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.auth.dependencies import VerifiedRequestContext, get_verified_context
from app.services.capabilities import Capability, require_capability
from app.services.computer_control import (
    ComputerMode,
    ComputerGrant,
    ComputerRun,
    ComputerRunPolicy,
    ComputerRunState,
)
from app.services.computer_action_policy import ComputerActionRejected, authorize_action
from app.services.computer_control import ComputerActionRequest
from app.services.computer_grant_security import ComputerGrantRejected, ComputerGrantReplayProtector, issue_grant, verify_grant
from app.services.computer_replay import replay_computer_events
from app.services.db import get_pool
from app.services.provenance import ProvenanceError, ProvenanceUnavailable, payload_hash, provenance_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/computer", tags=["Tayari Computer"])
_BRIDGE_REPLAY_PROTECTOR = ComputerGrantReplayProtector()


class ComputerRunCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ComputerMode
    capability: str
    allowed_origins: tuple[str, ...] = ()
    max_steps: int = Field(default=25, ge=1, le=100)
    selected_window_id: str | None = Field(default=None, min_length=1, max_length=128)
    selected_tab_id: str | None = Field(default=None, min_length=1, max_length=128)


class ComputerRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: UUID
    mode: ComputerMode
    state: ComputerRunState
    expires_at: datetime
    grant: dict
    signature: str


class ComputerBridgeAttachRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grant: dict
    signature: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")


class ComputerObservationRecordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grant: dict
    signature: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")
    observation_id: UUID
    document_generation: int = Field(ge=0, le=1_000_000)
    origin: str = Field(min_length=8, max_length=2048)
    url: str = Field(min_length=8, max_length=4096)
    content_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    screenshot_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")


class ComputerActionAuthorizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grant: dict
    signature: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")
    action: dict
    human_confirmed: bool = False


class ComputerRunStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: UUID
    user_id: UUID
    tenant_id: UUID
    mode: ComputerMode
    state: ComputerRunState
    provider: str | None = None
    selected_window_id: str | None = None
    selected_tab_id: str | None = None
    created_at: datetime
    expires_at: datetime | None = None
    revoked_at: datetime | None = None


def _capability_for_mode(mode: ComputerMode) -> Capability:
    return (
        Capability.WORKSPACE_ISOLATED_COMPUTER
        if mode is ComputerMode.ISOLATED
        else Capability.WORKSPACE_LOCAL_BROWSER_BRIDGE
    )


def _require_matching_capability(mode: ComputerMode, capability: str) -> None:
    expected = _capability_for_mode(mode).value
    if capability != expected:
        raise HTTPException(status_code=422, detail="mode and capability do not match")
    require_capability(expected)


def _policy_hash(policy: ComputerRunPolicy) -> str:
    payload = json.dumps(policy.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


async def _capture_computer_provenance(*, run: ComputerRun, event_name: str, content: dict, input_hashes: list[str] | None = None) -> bool:
    """Persist computer-control origin as hash-only AI provenance."""
    try:
        digest = payload_hash(content)
        await provenance_service.create_artifact(
            user_id=str(run.user_id),
            artifact_type="computer_run",
            content_hash=digest,
            event_type="ai_invoked",
            origin_actor="ai_system",
            producer_type="tayari_workflow",
            idempotency_key=f"computer-provenance:{run.run_id}:{event_name}:{digest}",
            metadata={
                "workflow": "tayari_computer",
                "computer_run_id": str(run.run_id),
                "tenant_id": str(run.tenant_id),
                "mode": run.mode.value,
                "capability": run.capability,
                "event_name": event_name,
                "provenance_capture": "hash_only",
            },
            input_hashes=input_hashes or [],
            output_hash=digest,
        )
        return True
    except (ProvenanceUnavailable, ProvenanceError, ValueError) as exc:
        logger.error("computer provenance capture failed event=%s error=%s", event_name, type(exc).__name__)
        return False


async def _insert_event(conn, *, run: ComputerRun, event_type: str, idempotency_key: str, metadata: dict | None = None) -> None:
    payload = json.dumps({"run_id": str(run.run_id), "event_type": event_type, "metadata": metadata or {}}, sort_keys=True, separators=(",", ":")).encode()
    await conn.execute(
        """
        INSERT INTO computer_run_events
            (run_id, user_id, tenant_id, idempotency_key, event_type, payload_hash, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (user_id, idempotency_key) DO NOTHING
        """,
        run.run_id,
        run.user_id,
        run.tenant_id,
        idempotency_key,
        event_type,
        hashlib.sha256(payload).hexdigest(),
        json.dumps(metadata or {}),
    )


@router.post("/runs", response_model=ComputerRunResponse, status_code=201)
async def create_computer_run(
    payload: ComputerRunCreateRequest,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    _require_matching_capability(payload.mode, payload.capability)
    try:
        user_id = UUID(context.subject)
        tenant_id = UUID(context.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="verified identity context is invalid") from exc

    policy = ComputerRunPolicy(
        allowed_origins=payload.allowed_origins,
        max_steps=payload.max_steps,
    )
    now = datetime.now(timezone.utc)
    run = ComputerRun(
        user_id=user_id,
        tenant_id=tenant_id,
        mode=payload.mode,
        state=ComputerRunState.AWAITING_APPROVAL,
        capability=payload.capability,
        policy=policy,
        selected_window_id=payload.selected_window_id,
        selected_tab_id=payload.selected_tab_id,
        created_at=now,
        expires_at=now.replace(microsecond=0) + timedelta(seconds=policy.grant_ttl_seconds),
    )
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="computer control storage is unavailable")
    audience = "tayari-browser-bridge" if payload.mode is ComputerMode.LOCAL_BROWSER_BRIDGE else "tayari-isolated-computer"
    key_id = "computer-bridge-v1"
    try:
        grant, signature = issue_grant(run, audience=audience, key_id=key_id, now=now)
    except ComputerGrantRejected as exc:
        raise HTTPException(status_code=503, detail="computer grant signing is unavailable") from exc
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO computer_runs
                        (id, user_id, tenant_id, mode, state, capability, policy,
                         provider, selected_window_id, selected_tab_id, expires_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
                    """,
                    run.run_id,
                    run.user_id,
                    run.tenant_id,
                    run.mode.value,
                    run.state.value,
                    run.capability,
                    json.dumps(policy.model_dump(mode="json")),
                    "opensandbox" if payload.mode is ComputerMode.ISOLATED else "local_browser_bridge",
                    run.selected_window_id,
                    run.selected_tab_id,
                    run.expires_at,
                )
                await conn.execute(
                    """
                    INSERT INTO computer_grants
                        (id, run_id, user_id, tenant_id, audience, nonce, issued_at,
                         expires_at, mode, capability, policy_hash, key_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                    grant.grant_id,
                    grant.run_id,
                    grant.user_id,
                    grant.tenant_id,
                    grant.audience,
                    grant.nonce,
                    grant.issued_at,
                    grant.expires_at,
                    grant.mode.value,
                    grant.capability,
                    _policy_hash(policy),
                    grant.key_id,
                )
                await _insert_event(
                    conn,
                    run=run,
                    event_type="run_requested",
                    idempotency_key=f"computer-run:{run.run_id}:requested",
                    metadata={"mode": run.mode.value, "capability": run.capability},
                )
                await _insert_event(
                    conn,
                    run=run,
                    event_type="grant_issued",
                    idempotency_key=f"computer-run:{run.run_id}:grant:{grant.grant_id}",
                    metadata={"audience": grant.audience, "key_id": grant.key_id},
                )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("computer run persistence failed")
        raise HTTPException(status_code=503, detail="computer control storage is unavailable") from exc
    if not await _capture_computer_provenance(
        run=run,
        event_name="run_requested",
        content={"run_id": str(run.run_id), "mode": run.mode.value, "capability": run.capability, "policy_hash": _policy_hash(policy)},
        input_hashes=[_policy_hash(policy)],
    ):
        raise HTTPException(status_code=503, detail="computer provenance storage is unavailable; run was not released")
    return ComputerRunResponse(
        run_id=run.run_id,
        mode=run.mode,
        state=run.state,
        expires_at=run.expires_at,
        grant=grant.model_dump(mode="json"),
        signature=signature,
    )


@router.post("/runs/{run_id}/bridge/attach")
async def attach_computer_bridge(
    run_id: UUID,
    payload: ComputerBridgeAttachRequest,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="computer control storage is unavailable")
    try:
        grant = ComputerGrant.model_validate(payload.grant)
        user_id = UUID(context.subject)
        tenant_id = UUID(context.tenant_id)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="invalid computer bridge grant") from exc
    if grant.run_id != run_id or grant.user_id != user_id or grant.tenant_id != tenant_id or grant.mode != ComputerMode.LOCAL_BROWSER_BRIDGE:
        raise HTTPException(status_code=403, detail="computer bridge grant is not bound to this run and identity")
    try:
        await verify_grant(
            grant,
            payload.signature,
            expected_audience="tayari-browser-bridge",
            replay_protector=_BRIDGE_REPLAY_PROTECTOR,
        )
    except ComputerGrantRejected as exc:
        raise HTTPException(status_code=403, detail="computer bridge grant rejected") from exc
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                UPDATE computer_runs
                SET state = 'granted'
                WHERE id = $1 AND user_id = $2 AND tenant_id = $3
                  AND state IN ('awaiting_approval', 'granted')
                  AND (revoked_at IS NULL OR revoked_at > now())
                RETURNING id, state, expires_at
                """,
                run_id,
                user_id,
                tenant_id,
            )
            if not row:
                raise HTTPException(status_code=409, detail="computer run is not attachable")
            run_stub = ComputerRun(
                run_id=run_id,
                user_id=user_id,
                tenant_id=tenant_id,
                mode=ComputerMode.LOCAL_BROWSER_BRIDGE,
                state=ComputerRunState.GRANTED,
                capability=Capability.WORKSPACE_LOCAL_BROWSER_BRIDGE.value,
            )
            await _insert_event(
                conn,
                run=run_stub,
                event_type="bridge_attached",
                idempotency_key=f"computer-run:{run_id}:bridge-attached:{grant.grant_id}",
                metadata={"audience": grant.audience, "key_id": grant.key_id},
            )
    return {"success": True, "run_id": str(run_id), "state": "granted", "expires_at": row["expires_at"]}


@router.post("/runs/{run_id}/bridge/observation")
async def record_computer_observation(
    run_id: UUID,
    payload: ComputerObservationRecordRequest,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="computer control storage is unavailable")
    try:
        grant = ComputerGrant.model_validate(payload.grant)
        user_id = UUID(context.subject)
        tenant_id = UUID(context.tenant_id)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="invalid computer observation envelope") from exc
    if grant.run_id != run_id or grant.user_id != user_id or grant.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="computer observation is not bound to this run and identity")
    if payload.origin not in grant.policy.allowed_origins:
        raise HTTPException(status_code=403, detail="computer observation origin is outside the signed policy")
    parsed_url = urlsplit(payload.url)
    parsed_origin = f"{parsed_url.scheme}://{parsed_url.netloc}" if parsed_url.scheme and parsed_url.netloc else ""
    if parsed_origin != payload.origin.rstrip("/"):
        raise HTTPException(status_code=403, detail="computer observation URL origin changed")
    try:
        await verify_grant(
            grant,
            payload.signature,
            expected_audience="tayari-browser-bridge",
            replay_protector=_BRIDGE_REPLAY_PROTECTOR,
            consume_nonce=False,
        )
    except ComputerGrantRejected as exc:
        raise HTTPException(status_code=403, detail="computer observation grant rejected") from exc
    metadata = {"url": payload.url, "document_generation": payload.document_generation, "screenshot_present": bool(payload.screenshot_sha256)}
    payload_hash = hashlib.sha256(json.dumps(metadata | {"content_sha256": payload.content_sha256}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO computer_run_events
                (run_id, user_id, tenant_id, idempotency_key, event_type,
                 origin, observation_hash, payload_hash, metadata)
            VALUES ($1, $2, $3, $4, 'observation_captured', $5, $6, $7, $8::jsonb)
            ON CONFLICT (user_id, idempotency_key) DO NOTHING
            """,
            run_id,
            user_id,
            tenant_id,
            f"computer-observation:{payload.observation_id}",
            payload.origin,
            payload.content_sha256,
            payload_hash,
            json.dumps(metadata),
        )
    run_stub = ComputerRun(
        run_id=run_id,
        user_id=user_id,
        tenant_id=tenant_id,
        mode=ComputerMode.LOCAL_BROWSER_BRIDGE,
        state=ComputerRunState.GRANTED,
        capability=Capability.WORKSPACE_LOCAL_BROWSER_BRIDGE.value,
    )
    if not await _capture_computer_provenance(
        run=run_stub,
        event_name="observation_captured",
        content={"run_id": str(run_id), "observation_id": str(payload.observation_id), "origin": payload.origin, "content_sha256": payload.content_sha256, "document_generation": payload.document_generation},
        input_hashes=[payload.content_sha256],
    ):
        raise HTTPException(status_code=503, detail="computer provenance storage is unavailable; observation was not acknowledged")
    return {"success": True, "observation_id": str(payload.observation_id), "recorded": True}


@router.post("/runs/{run_id}/bridge/action/authorize")
async def authorize_computer_action(
    run_id: UUID,
    payload: ComputerActionAuthorizeRequest,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="computer control storage is unavailable")
    try:
        grant = ComputerGrant.model_validate(payload.grant)
        action = ComputerActionRequest.model_validate(payload.action)
        user_id = UUID(context.subject)
        tenant_id = UUID(context.tenant_id)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="invalid computer action envelope") from exc
    if grant.run_id != run_id or action.run_id != run_id or grant.user_id != user_id or grant.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="computer action is not bound to this run and identity")
    try:
        decision = await authorize_action(
            action,
            grant,
            payload.signature,
            expected_audience="tayari-browser-bridge",
            replay_protector=_BRIDGE_REPLAY_PROTECTOR,
            human_confirmed=payload.human_confirmed,
        )
    except ComputerActionRejected as exc:
        raise HTTPException(status_code=403, detail="computer action rejected") from exc
    if decision.status == "confirmation_required":
        return {"success": False, "status": decision.status, "action_id": decision.action_id, "requires_human_confirmation": True}
    payload_hash = hashlib.sha256(json.dumps(action.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO computer_run_events
                (run_id, user_id, tenant_id, action_id, idempotency_key,
                 event_type, action_class, origin, observation_hash, payload_hash, metadata)
            VALUES ($1, $2, $3, $4, $5, 'action_requested', $6, $7, $8, $9, $10::jsonb)
            ON CONFLICT (user_id, idempotency_key) DO NOTHING
            """,
            run_id,
            user_id,
            tenant_id,
            action.action_id,
            f"computer-action:{action.action_id}:requested",
            action.action_class.value,
            action.origin,
            action.observation_sha256,
            payload_hash,
            json.dumps({"kind": action.kind, "status": decision.status}),
        )
    run_stub = ComputerRun(
        run_id=run_id,
        user_id=user_id,
        tenant_id=tenant_id,
        mode=grant.mode,
        state=ComputerRunState.GRANTED,
        capability=grant.capability,
    )
    if not await _capture_computer_provenance(
        run=run_stub,
        event_name="action_requested",
        content={"run_id": str(run_id), "action_id": str(action.action_id), "action_class": action.action_class.value, "origin": action.origin, "observation_sha256": action.observation_sha256, "status": decision.status},
        input_hashes=[action.observation_sha256] if action.observation_sha256 else [],
    ):
        raise HTTPException(status_code=503, detail="computer provenance storage is unavailable; action was not authorized")
    return {"success": True, "status": decision.status, "action_id": decision.action_id}


@router.get("/runs/{run_id}", response_model=ComputerRunStatusResponse)
async def get_computer_run(run_id: UUID, context: VerifiedRequestContext = Depends(get_verified_context)):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="computer control storage is unavailable")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, user_id, tenant_id, mode, state, provider,
                   selected_window_id, selected_tab_id, created_at, expires_at, revoked_at
            FROM computer_runs
            WHERE id = $1 AND user_id = $2 AND tenant_id = $3
            """,
            run_id,
            UUID(context.subject),
            UUID(context.tenant_id),
        )
    if not row:
        raise HTTPException(status_code=404, detail="computer run not found")
    return ComputerRunStatusResponse(**dict(row))


@router.post("/runs/{run_id}/revoke", response_model=ComputerRunStatusResponse)
async def revoke_computer_run(run_id: UUID, context: VerifiedRequestContext = Depends(get_verified_context)):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="computer control storage is unavailable")
    user_id = UUID(context.subject)
    tenant_id = UUID(context.tenant_id)
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                UPDATE computer_runs
                SET state = 'revoked', revoked_at = COALESCE(revoked_at, now())
                WHERE id = $1 AND user_id = $2 AND tenant_id = $3
                RETURNING id, user_id, tenant_id, mode, state, provider,
                          selected_window_id, selected_tab_id, created_at, expires_at, revoked_at
                """,
                run_id,
                user_id,
                tenant_id,
            )
            if not row:
                raise HTTPException(status_code=404, detail="computer run not found")
            run_stub = ComputerRun(
                run_id=run_id,
                user_id=user_id,
                tenant_id=tenant_id,
                mode=ComputerMode(row["mode"]),
                state=ComputerRunState.REVOKED,
                capability=("workspace.isolated_computer" if row["mode"] == "isolated" else "workspace.local_browser_bridge"),
            )
            await _insert_event(
                conn,
                run=run_stub,
                event_type="revoked",
                idempotency_key=f"computer-run:{run_id}:revoked",
                metadata={"reason": "owner_requested"},
            )
    await _capture_computer_provenance(
        run=run_stub,
        event_name="revoked",
        content={"run_id": str(run_id), "reason": "owner_requested", "state": ComputerRunState.REVOKED.value},
    )
    return ComputerRunStatusResponse(**dict(row))


# ============================================================================
# WP-04: Isolated Browser Worker Endpoints (Allowlist, Kill Switch & SSE Stream)
# ============================================================================

class ComputerWorkerStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str
    max_timeout: int = Field(default=600, ge=1, le=600)


@router.delete("/run/{run_id}")
@router.delete("/runs/{run_id}")
async def terminate_computer_run(
    run_id: str,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    """Hard kill switch: immediately terminate and clean up browser context within 5s."""
    from app.services.browser_worker_pool import terminate_worker

    terminated = False
    try:
        terminated = await terminate_worker(run_id, owner_id=context.subject)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    from app.services.browser_automation.session import cancel_run
    try:
        await cancel_run(run_id, owner_id=context.subject)
    except Exception:
        logger.debug("computer terminate cancel_run failed", exc_info=True)

    # If run exists in database, mark revoked. Opaque worker run_ids are not
    # control-plane UUIDs — parse explicitly so they flow through (skip DB
    # revoke) instead of being silently swallowed by a suppress-skip.
    pool = await get_pool()
    if pool:
        try:
            run_uuid = UUID(str(run_id))
            subject_uuid = UUID(context.subject)
        except (ValueError, AttributeError, TypeError):
            run_uuid = None
        if run_uuid is not None:
            try:
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE computer_runs
                        SET state = 'revoked', revoked_at = COALESCE(revoked_at, now())
                        WHERE id = $1 AND user_id = $2
                        """,
                        run_uuid,
                        subject_uuid,
                    )
            except Exception:
                logger.debug("computer terminate db revoke failed", exc_info=True)

    return {"success": True, "terminated": terminated, "run_id": run_id}


@router.post("/run/{run_id}/start")
@router.post("/runs/{run_id}/start")
async def start_computer_worker(
    run_id: str,
    payload: ComputerWorkerStartRequest,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    """Start an isolated browser worker for an allowlisted ATS URL."""
    from app.services.browser_worker_pool import (
        create_worker,
        start_worker_task,
        validate_ats_url,
    )

    # 1. Enforce strict allowlist at entry (403 Forbidden before Playwright launch)
    validate_ats_url(payload.url)

    pool = await get_pool()
    try:
        worker = await create_worker(
            run_id=run_id,
            user_id=context.subject,
            target_url=payload.url,
            max_timeout=payload.max_timeout,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    await start_worker_task(worker, pool=pool)
    return {"success": True, "run_id": run_id, "status": "started"}


async def _sse_stream_worker(worker: Any):
    """Stream worker events in SSE data: {...} format matching WP-04 schema."""
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    worker.subscribers.add(queue)
    try:
        # Replay past events first
        for ev in list(worker.events):
            yield f"data: {json.dumps(ev)}\n\n"

        while True:
            if worker.is_terminated and queue.empty():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=1.0)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("complete", "error") and (worker.is_terminated or worker.status in ("complete", "failed", "cancelled")):
                    break
            except asyncio.TimeoutError:
                if worker.is_terminated:
                    break
                yield ": keepalive\n\n"
    finally:
        worker.subscribers.discard(queue)


@router.get("/run/{run_id}/stream")
@router.get("/runs/{run_id}/stream")
async def stream_computer_run(
    run_id: str,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    """SSE event stream for active worker emitting {type, payload, step_index, ts}."""
    from app.services.browser_worker_pool import get_worker

    worker = get_worker(run_id)
    if not worker:
        raise HTTPException(status_code=404, detail="No active browser worker found for run")

    if worker.user_id and worker.user_id != context.subject:
        raise HTTPException(status_code=403, detail="Run belongs to another user")

    return StreamingResponse(
        _sse_stream_worker(worker),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _audit_replay_access(*, run_id: str, user_id: str, tenant_id: str) -> None:
    """Best-effort owner-scoped audit of replay access. Never raises.

    ponytail: durable ownership for no-active-worker replays cannot be enforced
    here — computer_runs/computer_run_events/action_ledger all key run_id as UUID
    while worker run_ids are opaque strings with no mapping table (inventing one is
    out of scope). The active-worker owner check above still rejects cross-user live
    access; every replay access below is audited with the verified owner predicate,
    DB row when the run_id is a control-plane UUID, structured log otherwise.
    (No request IP at this layer — the Go gateway owns transport.)
    visual_action/pause_required have no server handler paths (worker-emitted stream
    events only); terminal receipts are already owner-audited via
    record_action→action_ledger in browser_worker_pool.record_submission_receipt.
    """
    try:
        pool = await get_pool()
        if pool is None:
            raise RuntimeError("audit pool unavailable")
        async with pool.acquire() as conn:
            # Intentionally unique per access — every replay access is audited;
            # no per-second dedupe (ON CONFLICT still guards true retries).
            await conn.execute(
                """
                INSERT INTO computer_run_events
                    (run_id, user_id, tenant_id, idempotency_key, event_type, metadata)
                VALUES ($1, $2, $3, $4, 'replay_accessed', $5::jsonb)
                ON CONFLICT (user_id, idempotency_key) DO NOTHING
                """,
                UUID(str(run_id)),
                UUID(user_id),
                UUID(tenant_id),
                f"computer-replay:{run_id}:{user_id}:{uuid.uuid4().hex}",
                json.dumps({"action": "replay_accessed"}),
            )
    except Exception as exc:
        logger.info(
            "computer replay access user_id=%s run_id=%s action=replay_accessed db_audit=skipped reason=%s",
            user_id,
            run_id,
            type(exc).__name__,
        )


@router.get("/runs/{run_id}/events")
@router.get("/run/{run_id}/events")
async def replay_run_events(
    run_id: str,
    after: int = 0,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    from app.services.browser_worker_pool import get_worker

    # ponytail: mirror stream_computer_run owner check for live workers only
    worker = get_worker(str(run_id))
    if worker is not None and worker.user_id and worker.user_id != context.subject:
        raise HTTPException(status_code=403, detail="Run belongs to another user")
    # ponytail: owner-scoped Redis key — durable replay is per-user, a guessed run_id reads nothing
    cursor = max(0, int(after))
    # ponytail: audit never breaks replay — helper is fail-open by contract
    await _audit_replay_access(run_id=str(run_id), user_id=context.subject, tenant_id=context.tenant_id)
    # ponytail: reuse Task 1 helper; Redis fail-open keeps replay best-effort
    return await replay_computer_events(str(run_id), after=cursor, user_id=context.subject)


@router.post("/run/{run_id}/stream")
@router.post("/runs/{run_id}/stream")
async def start_and_stream_computer_run(
    run_id: str,
    payload: ComputerWorkerStartRequest,
    context: VerifiedRequestContext = Depends(get_verified_context),
):
    """Start worker with strict allowlist check and immediately stream SSE events."""
    from app.services.browser_worker_pool import (
        create_worker,
        get_worker,
        start_worker_task,
        validate_ats_url,
    )

    # Fails closed with 403 Forbidden before Playwright launch
    validate_ats_url(payload.url)

    worker = get_worker(run_id)
    if worker and not worker.is_terminated:
        # Existing live worker — enforce owner isolation before streaming
        if worker.user_id and worker.user_id != context.subject:
            raise HTTPException(status_code=403, detail="Run belongs to another user")
    else:
        pool = await get_pool()
        try:
            worker = await create_worker(
                run_id=run_id,
                user_id=context.subject,
                target_url=payload.url,
                max_timeout=payload.max_timeout,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        await start_worker_task(worker, pool=pool)

    return StreamingResponse(
        _sse_stream_worker(worker),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

