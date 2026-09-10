"""Unit tests for Saga Pattern and Browser Automation Compensation (Tier 2 — D2)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.browser_worker_pool import (
    BrowserWorker,
    DomainForbiddenError,
    execute_application_flow,
)
from app.services.saga import SagaContext, StepStatus


@pytest.mark.asyncio
async def test_saga_all_steps_succeed():
    """Test 1: All steps succeed -> returns success=True, all steps completed."""
    saga = SagaContext(task_id="task-101", user_id="user-202")
    call_log = []

    async def step_one():
        call_log.append("step_one")
        return {"status": "ok_1"}

    async def step_two():
        call_log.append("step_two")
        return {"status": "ok_2"}

    async def step_three():
        call_log.append("step_three")
        return {"status": "ok_3"}

    saga.add_step("step_one", execute=step_one)
    saga.add_step("step_two", execute=step_two)
    saga.add_step("step_three", execute=step_three)

    result = await saga.run()

    assert result["success"] is True
    assert result["steps_completed"] == ["step_one", "step_two", "step_three"]
    assert call_log == ["step_one", "step_two", "step_three"]
    assert len(saga.completed_steps) == 3
    assert all(s.status == StepStatus.COMPLETED for s in saga.steps)
    assert saga.steps[0].result == {"status": "ok_1"}
    assert saga.steps[1].result == {"status": "ok_2"}
    assert saga.steps[2].result == {"status": "ok_3"}


@pytest.mark.asyncio
async def test_saga_step2_fails_compensates_step1_reverse_order():
    """Test 2: Step 2 fails -> step 1 gets compensated in reverse order, returns success=False."""
    saga = SagaContext(task_id="task-102", user_id="user-202")
    events = []

    async def step1():
        events.append("exec_1")

    async def comp1():
        events.append("comp_1")

    async def step2():
        events.append("exec_2")
        raise RuntimeError("Step 2 network timeout")

    async def comp2():
        events.append("comp_2")

    saga.add_step("step1", execute=step1, compensate=comp1)
    saga.add_step("step2", execute=step2, compensate=comp2)

    result = await saga.run()

    assert result["success"] is False
    assert result["failed_step"] == "step2"
    assert "Step 2 network timeout" in result["error"]
    assert result["compensated"] == ["step1"]
    assert events == ["exec_1", "exec_2", "comp_1"]
    assert saga.steps[0].status == StepStatus.COMPENSATED
    assert saga.steps[1].status == StepStatus.FAILED


@pytest.mark.asyncio
async def test_saga_step3_fails_compensates_steps_in_reverse_order():
    """Verify multi-step rollback compensates in strict reverse chronological order."""
    saga = SagaContext(task_id="task-103", user_id="user-202")
    compensation_order = []

    async def step1():
        pass

    async def comp1():
        compensation_order.append("comp_step1")

    async def step2():
        pass

    async def comp2():
        compensation_order.append("comp_step2")

    async def step3():
        raise ValueError("Step 3 validation failure")

    async def comp3():
        compensation_order.append("comp_step3")

    saga.add_step("step1", execute=step1, compensate=comp1)
    saga.add_step("step2", execute=step2, compensate=comp2)
    saga.add_step("step3", execute=step3, compensate=comp3)

    result = await saga.run()

    assert result["success"] is False
    assert result["failed_step"] == "step3"
    assert result["compensated"] == ["step2", "step1"]
    assert compensation_order == ["comp_step2", "comp_step1"]
    assert saga.steps[0].status == StepStatus.COMPENSATED
    assert saga.steps[1].status == StepStatus.COMPENSATED
    assert saga.steps[2].status == StepStatus.FAILED


@pytest.mark.asyncio
async def test_saga_compensation_failure_is_caught_logged_and_does_not_crash():
    """Test 3: Compensation failure is caught, logged, and does not crash saga.run()."""
    saga = SagaContext(task_id="task-104", user_id="user-202")
    events = []

    async def step1():
        events.append("exec_1")

    async def comp1():
        events.append("comp_1")

    async def step2():
        events.append("exec_2")

    async def comp2():
        events.append("comp_2_explodes")
        raise RuntimeError("Compensation server unreachable")

    async def step3():
        events.append("exec_3")
        raise ValueError("Step 3 failure triggers compensation")

    saga.add_step("step1", execute=step1, compensate=comp1)
    saga.add_step("step2", execute=step2, compensate=comp2)
    saga.add_step("step3", execute=step3)

    # Must complete safely without raising an unhandled exception
    result = await saga.run()

    assert result["success"] is False
    assert result["failed_step"] == "step3"
    assert "Step 3 failure triggers compensation" in result["error"]
    # comp2 failed, but comp1 succeeded after it
    assert result["compensated"] == ["step1"]
    assert "comp_2_explodes" in events
    assert "comp_1" in events
    assert saga.steps[0].status == StepStatus.COMPENSATED
    assert saga.steps[1].status == StepStatus.COMPLETED  # was completed, comp failed so remains COMPLETED
    assert saga.steps[2].status == StepStatus.FAILED


@pytest.mark.asyncio
async def test_execute_application_flow_success():
    """Verify execute_application_flow executes navigate, fill, and review steps."""
    mock_page = AsyncMock()
    mock_page.content = AsyncMock(return_value="<html><body><div>Job Application</div></body></html>")
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.screenshot = AsyncMock(return_value=b"fake-image-png-bytes")

    result = await execute_application_flow(
        task_id="flow-task-1",
        user_id="user-1",
        page=mock_page,
        job_url="https://boards.greenhouse.io/acme/jobs/123",
        form_data={"#first_name": "Jane", "#last_name": "Doe"},
    )

    assert result["success"] is True
    assert result["steps_completed"] == [
        "navigate_to_job",
        "fill_application_form",
        "review_before_submit",
    ]
    mock_page.goto.assert_awaited_once_with(
        "https://boards.greenhouse.io/acme/jobs/123",
        wait_until="domcontentloaded",
        timeout=30000,
    )
    assert mock_page.fill.await_count == 2
    mock_page.screenshot.assert_awaited_once_with(full_page=False)


@pytest.mark.asyncio
async def test_execute_application_flow_fill_failure_compensates_navigation():
    """Verify fill failure triggers compensation: tab is cleared via about:blank."""
    mock_page = AsyncMock()
    mock_page.content = AsyncMock(return_value="<html><body><div>Job Application</div></body></html>")
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock(side_effect=RuntimeError("Input selector #first_name not found"))

    result = await execute_application_flow(
        task_id="flow-task-2",
        user_id="user-1",
        page=mock_page,
        job_url="https://boards.greenhouse.io/acme/jobs/123",
        form_data={"#first_name": "Jane"},
    )

    assert result["success"] is False
    assert result["failed_step"] == "fill_application_form"
    assert "Input selector #first_name not found" in result["error"]
    assert result["compensated"] == ["navigate_to_job"]

    # Compensation should have navigated to about:blank to clear the tab
    mock_page.goto.assert_any_await("about:blank")


@pytest.mark.asyncio
async def test_execute_application_flow_sensitive_field_aborts_and_compensates():
    """Verify sensitive field detection aborts fill step and triggers rollback."""
    mock_page = AsyncMock()
    # Form with password field
    mock_page.content = AsyncMock(return_value='<html><body><input type="password" name="password"/></body></html>')
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()

    result = await execute_application_flow(
        task_id="flow-task-3",
        user_id="user-1",
        page=mock_page,
        job_url="https://boards.greenhouse.io/acme/jobs/123",
        form_data={"#name": "John"},
    )

    assert result["success"] is False
    assert result["failed_step"] == "fill_application_form"
    assert "Sensitive field detected" in result["error"]
    assert result["compensated"] == ["navigate_to_job"]
    # Form fill should never have been attempted
    mock_page.fill.assert_not_called()
    # Navigation compensated
    mock_page.goto.assert_any_await("about:blank")


@pytest.mark.asyncio
async def test_execute_application_flow_disallowed_domain_fails():
    """Verify non-allowlisted ATS domain fails at navigation step."""
    mock_page = AsyncMock()

    result = await execute_application_flow(
        task_id="flow-task-4",
        user_id="user-1",
        page=mock_page,
        job_url="https://evil-phishing.com/apply",
        form_data={"#name": "John"},
    )

    assert result["success"] is False
    assert result["failed_step"] == "navigate_to_job"
    assert "403" in str(result["error"]) or "not allowlisted" in str(result["error"])
    assert result["compensated"] == []


@pytest.mark.asyncio
async def test_browser_worker_instance_method_execute_application_flow():
    """Verify BrowserWorker.execute_application_flow delegates correctly."""
    mock_page = AsyncMock()
    mock_page.content = AsyncMock(return_value="<html><body>Form</body></html>")
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.screenshot = AsyncMock(return_value=b"shot")

    worker = BrowserWorker(
        run_id="run-saga-99",
        user_id="user-saga-99",
        target_url="https://boards.greenhouse.io/acme/jobs/123",
        page=mock_page,
        owns_browser=False,
    )

    result = await worker.execute_application_flow(form_data={"#name": "Alice"})

    assert result["success"] is True
    assert result["steps_completed"] == [
        "navigate_to_job",
        "fill_application_form",
        "review_before_submit",
    ]
    # Verify worker events were emitted
    event_actions = [e.get("payload", {}).get("action") for e in worker.events]
    assert "navigate" in event_actions
    assert "fill_form" in event_actions
