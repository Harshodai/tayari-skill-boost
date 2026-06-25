"""AgentRouter Service.

Integrates different agent models and handles Human-in-the-loop tool approvals
by pausing execution and polling the database.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

from app.services.agent_db import create_runtime_approval, get_runtime_approval, create_agent_router_event
from app.services.llm_service import llm_complete, llm_json

logger = logging.getLogger(__name__)


class AgentRouter:
    """Standardizes agent execution and governs local runtime tool approvals."""

    def __init__(self, user_id: str, task_id: str | None = None, agent_id: str = "default_agent"):
        self.user_id = user_id
        self.task_id = task_id
        self.agent_id = agent_id

    async def execute_agent_step(
        self,
        system_prompt: str,
        user_prompt: str,
        runtime_id: str = "default",
        is_json: bool = False,
    ) -> Any:
        """Execute a step of the agent via the configured LLM/Hermes runtime."""
        # Map runtimes to tiers
        tier = "fast"
        if runtime_id == "hermes":
            tier = "hermes"
        
        logger.info(
            "AgentRouter executing step for user %s, agent %s using runtime %s",
            self.user_id, self.agent_id, runtime_id
        )

        if self.task_id:
            await create_agent_router_event(
                user_id=self.user_id,
                task_id=self.task_id,
                event_type="step_started",
                summary=f"Running step using {runtime_id} runtime",
                payload_json={"runtime_id": runtime_id, "is_json": is_json}
            )
        
        try:
            if is_json:
                res = await llm_json(system_prompt, user_prompt, tier=tier)
            else:
                res = await llm_complete(system_prompt, user_prompt, tier=tier)

            if self.task_id:
                await create_agent_router_event(
                    user_id=self.user_id,
                    task_id=self.task_id,
                    event_type="step_completed",
                    summary="Execution step completed successfully",
                    payload_json={"runtime_id": runtime_id}
                )
            return res
        except Exception as exc:
            if self.task_id:
                await create_agent_router_event(
                    user_id=self.user_id,
                    task_id=self.task_id,
                    event_type="step_failed",
                    summary=f"Step execution failed: {str(exc)}",
                    payload_json={"runtime_id": runtime_id}
                )
            raise

    async def request_tool_execution(
        self,
        tool_name: str,
        tool_input: dict[str, Any],
        content_preview: str,
        poll_interval_seconds: float = 1.0,
        timeout_seconds: float = 300.0,
    ) -> bool:
        """Request human approval before executing a tool.
        
        Creates a pending approval entry and polls the DB until approved or rejected.
        Returns True if approved, False if rejected.
        """
        logger.info(
            "Agent %s requesting tool approval for %s. Preview: %s",
            self.agent_id, tool_name, content_preview
        )
        
        approval_id = await create_runtime_approval(
            user_id=self.user_id,
            task_id=self.task_id,
            agent_id=self.agent_id,
            tool_name=tool_name,
            tool_input=tool_input,
            content_preview=content_preview
        )
        
        if not approval_id:
            logger.error("Failed to create tool approval entry for %s", tool_name)
            if self.task_id:
                await create_agent_router_event(
                    user_id=self.user_id,
                    task_id=self.task_id,
                    event_type="tool_error",
                    summary=f"Failed to request approval for tool '{tool_name}'",
                    payload_json={"tool_name": tool_name}
                )
            return False

        if self.task_id:
            await create_agent_router_event(
                user_id=self.user_id,
                task_id=self.task_id,
                event_type="approval_wait",
                summary=f"Waiting for human approval to run tool '{tool_name}'",
                payload_json={
                    "tool_name": tool_name,
                    "content_preview": content_preview,
                    "tool_input": tool_input,
                    "approval_id": approval_id
                }
            )

        # Poll the database for the user's decision
        elapsed = 0.0
        while elapsed < timeout_seconds:
            approval = await get_runtime_approval(self.user_id, approval_id)
            if not approval:
                logger.error("Approval record %s vanished during polling", approval_id)
                if self.task_id:
                    await create_agent_router_event(
                        user_id=self.user_id,
                        task_id=self.task_id,
                        event_type="tool_error",
                        summary=f"Approval record {approval_id} vanished",
                        payload_json={"tool_name": tool_name, "approval_id": approval_id}
                    )
                return False
                
            status = approval.get("status")
            if status == "approved":
                logger.info("Tool approval %s APPROVED", approval_id)
                if self.task_id:
                    await create_agent_router_event(
                        user_id=self.user_id,
                        task_id=self.task_id,
                        event_type="tool_approved",
                        summary=f"Tool '{tool_name}' was APPROVED",
                        payload_json={
                            "tool_name": tool_name,
                            "approval_id": approval_id,
                            "reviewer_comment": approval.get("reviewer_comment")
                        }
                    )
                return True
            elif status == "rejected":
                logger.info("Tool approval %s REJECTED. Comment: %s", 
                            approval_id, approval.get("reviewer_comment"))
                if self.task_id:
                    await create_agent_router_event(
                        user_id=self.user_id,
                        task_id=self.task_id,
                        event_type="tool_rejected",
                        summary=f"Tool '{tool_name}' was REJECTED",
                        payload_json={
                            "tool_name": tool_name,
                            "approval_id": approval_id,
                            "reviewer_comment": approval.get("reviewer_comment")
                        }
                    )
                return False
                
            await asyncio.sleep(poll_interval_seconds)
            elapsed += poll_interval_seconds

        logger.warning("Tool approval %s timed out after %s seconds", approval_id, timeout_seconds)
        if self.task_id:
            await create_agent_router_event(
                user_id=self.user_id,
                task_id=self.task_id,
                event_type="tool_timeout",
                summary=f"Approval request for tool '{tool_name}' timed out",
                payload_json={"tool_name": tool_name, "approval_id": approval_id}
            )
        # Timeout defaults to rejection for safety
        return False
