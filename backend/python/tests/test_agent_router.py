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
