"""Tests for the AgentRouter service and human-in-the-loop approvals flow.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent_router import AgentRouter
from app.services import agent_db


# ---------------------------------------------------------------------------
# AgentRouter tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_router_execute_step():
    """AgentRouter.execute_agent_step calls llm_complete/llm_json properly."""
    router = AgentRouter(user_id="user-123", task_id="task-456", agent_id="my-agent")

    with patch("app.services.agent_router.llm_complete", new_mock:=AsyncMock(return_value="completion text")):
        res = await router.execute_agent_step("sys", "user")
        assert res == "completion text"
        new_mock.assert_called_once_with("sys", "user", tier="fast")

    with patch("app.services.agent_router.llm_json", new_mock_json:=AsyncMock(return_value={"status": "ok"})):
        res = await router.execute_agent_step("sys", "user", is_json=True)
        assert res == {"status": "ok"}
        new_mock_json.assert_called_once_with("sys", "user", tier="fast")


@pytest.mark.asyncio
async def test_agent_router_tool_approval_approved():
    """request_tool_execution returns True if approval is approved."""
    router = AgentRouter(user_id="user-123", task_id="task-456", agent_id="my-agent")

    fake_approval = {
        "approval_id": "app-111",
        "status": "approved",
        "reviewer_comment": "Go ahead"
    }

    with patch("app.services.agent_router.create_runtime_approval", AsyncMock(return_value="app-111")), \
         patch("app.services.agent_router.get_runtime_approval", AsyncMock(return_value=fake_approval)):
        
        approved = await router.request_tool_execution(
            tool_name="submit_application",
            tool_input={"job_id": "abc"},
            content_preview="Applying to software engineer",
            poll_interval_seconds=0.01,
            timeout_seconds=0.1
        )
        assert approved is True


@pytest.mark.asyncio
async def test_agent_router_tool_approval_rejected():
    """request_tool_execution returns False if approval is rejected."""
    router = AgentRouter(user_id="user-123", task_id="task-456", agent_id="my-agent")

    fake_approval = {
        "approval_id": "app-111",
        "status": "rejected",
        "reviewer_comment": "Do not submit"
    }

    with patch("app.services.agent_router.create_runtime_approval", AsyncMock(return_value="app-111")), \
         patch("app.services.agent_router.get_runtime_approval", AsyncMock(return_value=fake_approval)):
        
        approved = await router.request_tool_execution(
            tool_name="submit_application",
            tool_input={"job_id": "abc"},
            content_preview="Applying to software engineer",
            poll_interval_seconds=0.01,
            timeout_seconds=0.1
        )
        assert approved is False


@pytest.mark.asyncio
async def test_agent_router_step_logging():
    """AgentRouter.execute_agent_step logs step_started and step_completed events if task_id set."""
    router = AgentRouter(user_id="user-123", task_id="task-456", agent_id="my-agent")
    
    mock_log_event = AsyncMock(return_value=True)
    with patch("app.services.agent_router.llm_complete", AsyncMock(return_value="done")), \
         patch("app.services.agent_router.create_agent_router_event", mock_log_event):
        
        res = await router.execute_agent_step("sys", "user")
        assert res == "done"
        
        # Should have called create_agent_router_event twice: step_started and step_completed
        assert mock_log_event.call_count == 2
        mock_log_event.assert_any_call(
            user_id="user-123",
            task_id="task-456",
            event_type="step_started",
            summary="Running step using default runtime",
            payload_json={"runtime_id": "default", "is_json": False}
        )
        mock_log_event.assert_any_call(
            user_id="user-123",
            task_id="task-456",
            event_type="step_completed",
            summary="Execution step completed successfully",
            payload_json={"runtime_id": "default"}
        )


@pytest.mark.asyncio
async def test_agent_router_tool_approval_logging():
    """request_tool_execution logs approval_wait and tool_approved if task_id set."""
    router = AgentRouter(user_id="user-123", task_id="task-456", agent_id="my-agent")

    fake_approval = {
        "approval_id": "app-111",
        "status": "approved",
        "reviewer_comment": "ok"
    }
    
    mock_log_event = AsyncMock(return_value=True)
    with patch("app.services.agent_router.create_runtime_approval", AsyncMock(return_value="app-111")), \
         patch("app.services.agent_router.get_runtime_approval", AsyncMock(return_value=fake_approval)), \
         patch("app.services.agent_router.create_agent_router_event", mock_log_event):
        
        approved = await router.request_tool_execution(
            tool_name="submit_application",
            tool_input={"job_id": "abc"},
            content_preview="Applying to software engineer",
            poll_interval_seconds=0.01,
            timeout_seconds=0.1
        )
        assert approved is True
        
        # Logs approval_wait and tool_approved
        assert mock_log_event.call_count == 2
        mock_log_event.assert_any_call(
            user_id="user-123",
            task_id="task-456",
            event_type="approval_wait",
            summary="Waiting for human approval to run tool 'submit_application'",
            payload_json={
                "tool_name": "submit_application",
                "content_preview": "Applying to software engineer",
                "tool_input": {"job_id": "abc"},
                "approval_id": "app-111"
            }
        )
        mock_log_event.assert_any_call(
            user_id="user-123",
            task_id="task-456",
            event_type="tool_approved",
            summary="Tool 'submit_application' was APPROVED",
            payload_json={
                "tool_name": "submit_application",
                "approval_id": "app-111",
                "reviewer_comment": "ok"
            }
        )


# ---------------------------------------------------------------------------
# agent_db Tasks, Attempts, and Events tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_db_create_agent_task(monkeypatch):
    """create_agent_task inserts record and returns task_id."""
    fake_pool = AsyncMock()
    fake_conn = AsyncMock()
    fake_pool.acquire.return_value.__aenter__.return_value = fake_conn
    monkeypatch.setattr(agent_db, "get_pool", AsyncMock(return_value=fake_pool))

    fake_conn.fetchrow.return_value = {"task_id": "new-task-uuid"}
    task_id = await agent_db.create_agent_task(
        user_id="user-1",
        agent_id="agent-1",
        title="Scrape Jobs",
        input_json={"keywords": ["python"]}
    )
    assert task_id == "new-task-uuid"
    fake_conn.fetchrow.assert_called_once()


@pytest.mark.asyncio
async def test_agent_db_get_agent_task(monkeypatch):
    """get_agent_task fetches a single task by ID and parses JSONB strings."""
    fake_pool = AsyncMock()
    fake_conn = AsyncMock()
    fake_pool.acquire.return_value.__aenter__.return_value = fake_conn
    monkeypatch.setattr(agent_db, "get_pool", AsyncMock(return_value=fake_pool))

    fake_conn.fetchrow.return_value = {
        "task_id": "new-task-uuid",
        "user_id": "user-1",
        "agent_id": "agent-1",
        "title": "Scrape Jobs",
        "status": "queued",
        "input_json": '{"keywords": ["python"]}',
        "result_json": '{"jobs_found": 12}',
        "error_text": None,
        "created_at": None,
        "updated_at": None
    }
    task = await agent_db.get_agent_task("user-1", "new-task-uuid")
    assert task is not None
    assert task["task_id"] == "new-task-uuid"
    assert task["input_json"] == {"keywords": ["python"]}
    assert task["result_json"] == {"jobs_found": 12}


@pytest.mark.asyncio
async def test_agent_db_list_agent_tasks(monkeypatch):
    """list_agent_tasks returns a list of tasks for the user."""
    fake_pool = AsyncMock()
    fake_conn = AsyncMock()
    fake_pool.acquire.return_value.__aenter__.return_value = fake_conn
    monkeypatch.setattr(agent_db, "get_pool", AsyncMock(return_value=fake_pool))

    fake_conn.fetch.return_value = [
        {
            "task_id": "task-uuid-1",
            "user_id": "user-1",
            "agent_id": "agent-1",
            "title": "Scrape Jobs",
            "status": "success",
            "input_json": '{"keywords": ["python"]}',
            "result_json": '{"jobs_found": 12}',
            "error_text": None,
            "created_at": None,
            "updated_at": None
        }
    ]
    tasks = await agent_db.list_agent_tasks("user-1", agent_id="agent-1")
    assert len(tasks) == 1
    assert tasks[0]["task_id"] == "task-uuid-1"
    assert tasks[0]["status"] == "success"


@pytest.mark.asyncio
async def test_agent_db_update_agent_task_status(monkeypatch):
    """update_agent_task_status updates the status of the task."""
    fake_pool = AsyncMock()
    fake_conn = AsyncMock()
    fake_pool.acquire.return_value.__aenter__.return_value = fake_conn
    monkeypatch.setattr(agent_db, "get_pool", AsyncMock(return_value=fake_pool))

    success = await agent_db.update_agent_task_status(
        user_id="user-1",
        task_id="task-uuid-1",
        status="success",
        result_json={"jobs_found": 10},
        error_text=None
    )
    assert success is True
    fake_conn.execute.assert_called_once()


@pytest.mark.asyncio
async def test_agent_db_task_attempts(monkeypatch):
    """create and update agent task attempt executes properly."""
    fake_pool = AsyncMock()
    fake_conn = AsyncMock()
    fake_pool.acquire.return_value.__aenter__.return_value = fake_conn
    monkeypatch.setattr(agent_db, "get_pool", AsyncMock(return_value=fake_pool))

    fake_conn.fetchrow.return_value = {"attempt_id": "attempt-uuid-1"}
    attempt_id = await agent_db.create_agent_task_attempt(
        user_id="user-1",
        task_id="task-uuid-1",
        attempt_number=1,
        status="running"
    )
    assert attempt_id == "attempt-uuid-1"

    success = await agent_db.update_agent_task_attempt(
        user_id="user-1",
        attempt_id="attempt-uuid-1",
        status="success",
        error_text=None
    )
    assert success is True


@pytest.mark.asyncio
async def test_agent_db_router_events(monkeypatch):
    """create and list agent router events executes properly."""
    fake_pool = AsyncMock()
    fake_conn = AsyncMock()
    fake_pool.acquire.return_value.__aenter__.return_value = fake_conn
    monkeypatch.setattr(agent_db, "get_pool", AsyncMock(return_value=fake_pool))

    success = await agent_db.create_agent_router_event(
        user_id="user-1",
        task_id="task-uuid-1",
        event_type="info",
        summary="Task started",
        payload_json={"step": 1}
    )
    assert success is True

    fake_conn.fetch.return_value = [
        {
            "event_id": "event-uuid-1",
            "user_id": "user-1",
            "task_id": "task-uuid-1",
            "type": "info",
            "summary": "Task started",
            "payload_json": '{"step": 1}',
            "created_at": None
        }
    ]
    events = await agent_db.list_agent_router_events("user-1", "task-uuid-1")
    assert len(events) == 1
    assert events[0]["event_id"] == "event-uuid-1"
    assert events[0]["payload_json"] == {"step": 1}

