"""Tests for WP-03 Canonical Application State Machine & Action Ledger.

Verifies:
- Canonical sequence: prepared -> reviewed -> candidate_confirmed -> approved -> attempted -> receipt_confirmed -> externally_verified
- Strict rejection of invalid state skips
- Owner scoping (verified user_id required)
- Idempotent action logging in action_ledger (attempt_count increment)
- Receipt reconciliation against ledger before moving to receipt_confirmed
- FastAPI route contract (/api/v1/application-runs/{id}, /transition)
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import copy
from datetime import datetime, timezone
import hashlib
import json
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.services import application_lifecycle as al
from app.services.application_lifecycle import (
    APPROVED,
    ATTEMPTED,
    CANDIDATE_CONFIRMED,
    EXTERNALLY_VERIFIED,
    PREPARED,
    RECEIPT_CONFIRMED,
    REVIEWED,
    InvalidApplicationTransition,
)


class MockRecord(dict):
    """Dict-like record mimicking asyncpg.Record."""
    def __getitem__(self, item: str) -> Any:
        return super().__getitem__(item)


class MockDBConnection:
    def __init__(self):
        self.runs: dict[tuple[str, str], dict[str, Any]] = {}
        self.ledger: dict[tuple[str, str], dict[str, Any]] = {}
        self.queries: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, query: str, *args) -> MockRecord | None:
        self.queries.append((query, args))
        q = query.strip()

        if "INSERT INTO public.application_runs" in q:
            # args: user_id, job_id, resume_version_hash, cover_letter_version_hash, state, state_history
            user_id, job_id, resume_hash, cover_hash, state, history_json = args
            run_id = str(uuid.uuid4())
            now_iso = datetime.now(timezone.utc)
            row_data = {
                "id": run_id,
                "user_id": str(user_id),
                "job_id": job_id,
                "resume_version_hash": resume_hash,
                "cover_letter_version_hash": cover_hash,
                "state": state,
                "state_history": json.loads(history_json) if isinstance(history_json, str) else history_json,
                "approval_token_id": None,
                "receipt_hash": None,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            self.runs[(run_id, str(user_id))] = row_data
            return MockRecord(row_data)

        if "SELECT id, user_id" in q and "FROM public.application_runs" in q:
            # args: run_id, user_id
            run_id, user_id = str(args[0]), str(args[1])
            data = self.runs.get((run_id, user_id))
            return MockRecord(copy.deepcopy(data)) if data else None

        if "UPDATE public.application_runs" in q:
            # args: norm_state, history_json, approval_token_id, receipt_hash, run_id, user_id, [current_state]
            new_state, history_json, approval_id, receipt_h, run_id, user_id, *rest = args
            run_id_str, user_id_str = str(run_id), str(user_id)
            data = self.runs.get((run_id_str, user_id_str))
            if not data:
                return None
            if rest and data.get("state") != rest[0]:
                return None
            data["state"] = new_state
            data["state_history"] = json.loads(history_json) if isinstance(history_json, str) else history_json
            if approval_id:
                data["approval_token_id"] = str(approval_id)
            if receipt_h:
                data["receipt_hash"] = str(receipt_h)
            data["updated_at"] = datetime.now(timezone.utc)
            return MockRecord(copy.deepcopy(data))


        if "INSERT INTO public.action_ledger" in q:
            # args: run_id, user_id, action_type, idempotency_key, status, receipt_json, external_url
            run_id, user_id, action_type, idem_key, status, receipt_json, external_url = args
            key = (str(run_id), str(idem_key))
            now_iso = datetime.now(timezone.utc)
            receipt_data = json.loads(receipt_json) if receipt_json else None
            if key in self.ledger:
                entry = self.ledger[key]
                entry["attempt_count"] += 1
                entry["status"] = status
                if receipt_data is not None:
                    entry["receipt"] = receipt_data
                if external_url is not None:
                    entry["external_url"] = external_url
            else:
                entry = {
                    "id": str(uuid.uuid4()),
                    "run_id": str(run_id),
                    "user_id": str(user_id),
                    "action_type": action_type,
                    "idempotency_key": str(idem_key),
                    "attempt_count": 1,
                    "status": status,
                    "receipt": receipt_data,
                    "external_url": external_url,
                    "created_at": now_iso,
                }
                self.ledger[key] = entry
            return MockRecord(copy.deepcopy(entry))

        return None

    async def fetch(self, query: str, *args) -> list[MockRecord]:
        self.queries.append((query, args))
        q = query.strip()
        if "FROM public.action_ledger" in q:
            run_id, user_id = str(args[0]), str(args[1])
            results = [
                MockRecord(copy.deepcopy(entry))
                for (r_id, _), entry in self.ledger.items()
                if r_id == run_id and entry["user_id"] == user_id
            ]
            return results
        return []

    async def execute(self, query: str, *args) -> str:
        self.queries.append((query, args))
        return "SUCCESS"


class MockDBPool:
    def __init__(self, conn: MockDBConnection):
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn


@pytest.fixture
def mock_db():
    conn = MockDBConnection()
    return conn, MockDBPool(conn)


# -----------------------------------------------------------------------------
# Unit Tests: Canonical State Graph & Invalid Skip Rejection
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_canonical_linear_state_machine_flow(mock_db):
    conn, pool = mock_db
    user_id = str(uuid.uuid4())

    run = await al.create_application_run(
        user_id=user_id,
        job_id="job-101",
        resume_version_hash="res_v1_hash",
        cover_letter_version_hash="cov_v1_hash",
        pool=pool,
    )
    run_id = run["id"]
    assert run["state"] == PREPARED
    assert len(run["state_history"]) == 1

    # 1. prepared -> reviewed
    step1 = await al.transition_state(run_id, REVIEWED, actor="candidate", user_id=user_id, pool=pool)
    assert step1["state"] == REVIEWED
    assert len(step1["state_history"]) == 2

    # 2. reviewed -> candidate_confirmed
    step2 = await al.transition_state(run_id, CANDIDATE_CONFIRMED, actor="candidate", user_id=user_id, pool=pool)
    assert step2["state"] == CANDIDATE_CONFIRMED

    # 3. candidate_confirmed -> approved
    token_id = str(uuid.uuid4())
    step3 = await al.transition_state(
        run_id,
        APPROVED,
        actor="candidate",
        evidence={"approval_token_id": token_id},
        user_id=user_id,
        pool=pool,
    )
    assert step3["state"] == APPROVED
    assert step3["approval_token_id"] == token_id

    # 4. approved -> attempted
    step4 = await al.transition_state(run_id, ATTEMPTED, actor="browser_agent", user_id=user_id, pool=pool)
    assert step4["state"] == ATTEMPTED

    # 5. attempted -> receipt_confirmed
    receipt_hash = "receipt_abc_123"
    step5 = await al.transition_state(
        run_id,
        RECEIPT_CONFIRMED,
        actor="reconciliation",
        evidence={"receipt_hash": receipt_hash},
        user_id=user_id,
        pool=pool,
    )
    assert step5["state"] == RECEIPT_CONFIRMED
    assert step5["receipt_hash"] == receipt_hash

    # 6. receipt_confirmed -> externally_verified
    step6 = await al.transition_state(run_id, EXTERNALLY_VERIFIED, actor="system", user_id=user_id, pool=pool)
    assert step6["state"] == EXTERNALLY_VERIFIED


@pytest.mark.asyncio
async def test_rejection_of_invalid_state_skips(mock_db):
    conn, pool = mock_db
    user_id = str(uuid.uuid4())

    run = await al.create_application_run(user_id=user_id, pool=pool)
    run_id = run["id"]

    # In prepared: cannot skip to approved, attempted, receipt_confirmed, externally_verified
    for invalid_target in [APPROVED, ATTEMPTED, RECEIPT_CONFIRMED, EXTERNALLY_VERIFIED, "unknown_status"]:
        with pytest.raises(InvalidApplicationTransition):
            await al.transition_state(run_id, invalid_target, actor="test", user_id=user_id, pool=pool)

    # Move to reviewed
    await al.transition_state(run_id, REVIEWED, actor="candidate", user_id=user_id, pool=pool)

    # In reviewed: cannot skip directly to approved or attempted
    for invalid_target in [APPROVED, ATTEMPTED, RECEIPT_CONFIRMED, EXTERNALLY_VERIFIED]:
        with pytest.raises(InvalidApplicationTransition):
            await al.transition_state(run_id, invalid_target, actor="test", user_id=user_id, pool=pool)


@pytest.mark.asyncio
async def test_transition_state_is_idempotent_for_same_state(mock_db):
    conn, pool = mock_db
    user_id = str(uuid.uuid4())

    run = await al.create_application_run(user_id=user_id, pool=pool)
    run_id = run["id"]

    same = await al.transition_state(run_id, PREPARED, actor="candidate", user_id=user_id, pool=pool)
    assert same["state"] == PREPARED
    assert same["id"] == run_id


@pytest.mark.asyncio
async def test_owner_scoping_enforced(mock_db):
    conn, pool = mock_db
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    run_a = await al.create_application_run(user_id=user_a, pool=pool)

    # User B cannot access or transition User A's run
    run_lookup = await al.get_application_run(run_a["id"], user_id=user_b, pool=pool)
    assert run_lookup is None

    with pytest.raises(ValueError, match="not found"):
        await al.transition_state(run_a["id"], REVIEWED, actor="user_b", user_id=user_b, pool=pool)

    # Missing user_id fails closed
    with pytest.raises(ValueError, match="user_id is required"):
        await al.transition_state(run_a["id"], REVIEWED, actor="anon", user_id="", pool=pool)


# -----------------------------------------------------------------------------
# Unit Tests: Idempotent Action Ledger
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_idempotent_action_ledger_logging(mock_db):
    conn, pool = mock_db
    user_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())

    action_key = "sub_attempt_001"
    receipt_payload = {"confirmation_number": "CONF-9999", "status": "sent"}

    # Attempt 1
    log1 = await al.log_action(
        run_id=run_id,
        user_id=user_id,
        action_type="submit",
        idempotency_key=action_key,
        status="pending",
        receipt=None,
        pool=pool,
    )
    assert log1["attempt_count"] == 1
    assert log1["status"] == "pending"
    assert log1["idempotency_key"] == action_key

    # Attempt 2 with same idempotency_key (retry / confirmation)
    log2 = await al.log_action(
        run_id=run_id,
        user_id=user_id,
        action_type="submit",
        idempotency_key=action_key,
        status="completed",
        receipt=receipt_payload,
        external_url="https://boards.greenhouse.io/acme/jobs/123",
        pool=pool,
    )
    assert log2["attempt_count"] == 2
    assert log2["status"] == "completed"
    assert log2["receipt"]["confirmation_number"] == "CONF-9999"
    assert log2["external_url"] == "https://boards.greenhouse.io/acme/jobs/123"


# -----------------------------------------------------------------------------
# Unit Tests: Receipt Reconciliation Against Action Ledger
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reconcile_receipt_advances_to_receipt_confirmed_when_ledger_matches(mock_db):
    conn, pool = mock_db
    user_id = str(uuid.uuid4())

    # Create run and advance to attempted
    run = await al.create_application_run(user_id=user_id, pool=pool)
    run_id = run["id"]
    await al.transition_state(run_id, REVIEWED, actor="candidate", user_id=user_id, pool=pool)
    await al.transition_state(run_id, CANDIDATE_CONFIRMED, actor="candidate", user_id=user_id, pool=pool)
    await al.transition_state(run_id, APPROVED, actor="candidate", user_id=user_id, pool=pool)
    await al.transition_state(run_id, ATTEMPTED, actor="agent", user_id=user_id, pool=pool)

    # Log action in ledger with receipt
    receipt_data = {"receipt_hash": "rcpt_verified_777", "ats": "greenhouse"}
    await al.log_action(
        run_id=run_id,
        user_id=user_id,
        action_type="submit",
        idempotency_key="key_777",
        status="completed",
        receipt=receipt_data,
        pool=pool,
    )

    # Reconcile receipt using the receipt_hash
    reconciled = await al.reconcile_receipt(run_id, "rcpt_verified_777", user_id, pool=pool)
    assert reconciled["state"] == RECEIPT_CONFIRMED
    assert reconciled["receipt_hash"] == "rcpt_verified_777"


@pytest.mark.asyncio
async def test_reconcile_receipt_fails_when_not_in_ledger(mock_db):
    conn, pool = mock_db
    user_id = str(uuid.uuid4())

    run = await al.create_application_run(user_id=user_id, pool=pool)
    run_id = run["id"]
    await al.transition_state(run_id, REVIEWED, actor="candidate", user_id=user_id, pool=pool)
    await al.transition_state(run_id, CANDIDATE_CONFIRMED, actor="candidate", user_id=user_id, pool=pool)
    await al.transition_state(run_id, APPROVED, actor="candidate", user_id=user_id, pool=pool)
    await al.transition_state(run_id, ATTEMPTED, actor="agent", user_id=user_id, pool=pool)

    # Attempt reconciliation with unrecorded receipt
    with pytest.raises(ValueError, match="not validated against action ledger"):
        await al.reconcile_receipt(run_id, "unrecorded_receipt_999", user_id, pool=pool)


@pytest.mark.asyncio
async def test_reconcile_receipt_rejects_skip_if_run_not_in_attempted(mock_db):
    conn, pool = mock_db
    user_id = str(uuid.uuid4())

    # Run is still in PREPARED
    run = await al.create_application_run(user_id=user_id, pool=pool)
    run_id = run["id"]

    # Even if receipt is in ledger, state machine must reject invalid skip from prepared -> receipt_confirmed
    await al.log_action(
        run_id=run_id,
        user_id=user_id,
        action_type="submit",
        idempotency_key="key_premature",
        status="completed",
        receipt={"receipt_hash": "rcpt_premature"},
        pool=pool,
    )

    with pytest.raises(InvalidApplicationTransition, match="reject invalid state skips"):
        await al.reconcile_receipt(run_id, "rcpt_premature", user_id, pool=pool)


# -----------------------------------------------------------------------------
# Integration Tests: FastAPI Endpoints
# -----------------------------------------------------------------------------

def test_api_application_runs_requires_auth():
    client = TestClient(app)
    # Anonymous GET must return 401
    resp_get = client.get("/api/v1/application-runs/00000000-0000-0000-0000-000000000001")
    assert resp_get.status_code == 401

    # Anonymous POST transition must return 401
    resp_post = client.post(
        "/api/v1/application-runs/00000000-0000-0000-0000-000000000001/transition",
        json={"new_state": "reviewed"},
    )
    assert resp_post.status_code == 401


def test_api_application_runs_get_and_transition(mock_db):
    conn, pool = mock_db
    client = TestClient(app)
    user_id = str(uuid.uuid4())

    # Override get_current_user to return our verified test user
    app.dependency_overrides[get_current_user] = lambda: user_id

    # Create run directly in mock db
    run = asyncio.run(al.create_application_run(user_id=user_id, job_id="job_fastapi_test", pool=pool))
    run_id = run["id"]

    try:
        with pytest.MonkeyPatch.context() as mp:
            async def fake_get_pool():
                return pool
            mp.setattr("app.services.application_lifecycle.get_pool", fake_get_pool)

            # 1. GET application run
            res_get = client.get(f"/api/v1/application-runs/{run_id}")
            assert res_get.status_code == 200
            assert res_get.json()["id"] == run_id
            assert res_get.json()["state"] == PREPARED

            # 2. POST transition: prepared -> reviewed
            res_trans = client.post(
                f"/api/v1/application-runs/{run_id}/transition",
                json={"new_state": REVIEWED, "actor": "candidate"},
            )
            assert res_trans.status_code == 200
            assert res_trans.json()["state"] == REVIEWED

            # 3. POST invalid skip: reviewed -> attempted (must return 400)
            res_invalid = client.post(
                f"/api/v1/application-runs/{run_id}/transition",
                json={"new_state": ATTEMPTED, "actor": "candidate"},
            )
            assert res_invalid.status_code == 400
            assert "reject invalid state skips" in res_invalid.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
