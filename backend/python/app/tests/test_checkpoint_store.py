"""Unit tests for WP-11: Durable Postgres Checkpoint Store and State Rewind."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.checkpoint_store import (
    compute_state_hash,
    verify_checkpoint_hash,
    CheckpointIntegrityError,
    CheckpointNotFoundError,
    save_checkpoint,
    get_checkpoint,
    list_checkpoints,
    resume_from_checkpoint,
)


def test_compute_and_verify_state_hash():
    state1 = {"step": 1, "task": "parse_resume", "status": "ok"}
    h1 = compute_state_hash(state1)
    assert len(h1) == 64
    assert verify_checkpoint_hash(state1, h1) is True

    # Order invariance via canonical json
    state2 = {"status": "ok", "task": "parse_resume", "step": 1}
    assert compute_state_hash(state2) == h1

    # Tampered state fails verification
    tampered = {"step": 1, "task": "parse_resume", "status": "corrupted"}
    assert verify_checkpoint_hash(tampered, h1) is False


@pytest.mark.asyncio
async def test_save_and_get_checkpoint_in_memory():
    run_id = "11111111-1111-1111-1111-111111111111"
    user_id = "22222222-2222-2222-2222-222222222222"
    state = {"plan": ["step1", "step2"], "current": "step1"}

    mock_row = {
        "id": "33333333-3333-3333-3333-333333333333",
        "run_id": run_id,
        "user_id": user_id,
        "step_index": 1,
        "state_json": state,
        "state_hash": compute_state_hash(state),
        "approver_user_id": None,
        "created_at": "2026-09-03T11:00:00Z",
    }

    mock_pool = MagicMock()
    mock_conn = MagicMock()
    mock_conn.fetchrow = AsyncMock(return_value=mock_row)
    mock_conn.fetch = AsyncMock(return_value=[mock_row])
    mock_conn.fetchval = AsyncMock(return_value=None)  # Must be AsyncMock; co-routine otherwise
    mock_conn.execute = AsyncMock(return_value=None)
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    # Test save_checkpoint
    saved = await save_checkpoint(
        run_id=run_id,
        step_index=1,
        state_dict=state,
        user_id=user_id,
        pool=mock_pool,
    )
    assert saved["run_id"] == run_id
    assert saved["step_index"] == 1
    assert saved["state_hash"] == compute_state_hash(state)

    # Test get_checkpoint
    retrieved = await get_checkpoint(
        run_id=run_id,
        step_index=1,
        user_id=user_id,
        pool=mock_pool,
    )
    assert retrieved["run_id"] == run_id
    assert retrieved["step_index"] == 1

    # Test resume_from_checkpoint restores verified state
    resumed = await resume_from_checkpoint(
        run_id=run_id,
        step_index=1,
        user_id=user_id,
        pool=mock_pool,
    )
    assert resumed["step_index"] == 1
    assert resumed["state_json"]["current"] == "step1"
