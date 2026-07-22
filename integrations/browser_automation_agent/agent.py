"""Browser automation agent powered by browser-use + LangChain.

This module wires a LangChain `ChatOpenAI` or `ChatAnthropic` client into a `browser-use` Agent.
Supports multi-provider configuration: Orq.ai, OpenRouter, OpenAI, Anthropic, Hermes, Ollama, and generic OpenAI-compatible providers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from dotenv import load_dotenv

load_dotenv()

# Hard cap on the number of browser steps a single instruction may take.
DEFAULT_MAX_STEPS = int(os.getenv("AGENT_MAX_STEPS", "25"))


@dataclass
class AgentResult:
    """Structured result returned to the UI or system layer."""

    instruction: str
    success: bool
    summary: str
    visited_urls: List[str] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    error: Optional[str] = None

    def to_markdown(self) -> str:
        """Render the result as a chat-friendly markdown block."""
        status = "✅ Completed" if self.success else "⚠️ Did not complete"
        lines = [f"**{status}**", "", self.summary.strip() or "_No summary produced._"]

        if self.visited_urls:
            lines += ["", "**Pages visited:**"]
            lines += [f"- {url}" for url in self.visited_urls[:10]]

        if self.actions:
            lines += ["", "<details><summary>Action log</summary>", ""]
            lines += [f"{i + 1}. {action}" for i, action in enumerate(self.actions[:30])]
            lines += ["", "</details>"]

        if self.error:
            lines += ["", f"**Error:** `{self.error}`"]

        return "\n".join(lines)


def get_llm():
    """Build the LangChain / browser-use chat model supporting multi-provider configuration."""
    try:
        from browser_use import ChatOpenAI
    except ImportError as exc:
        raise ImportError("browser-use is not installed. Install browser-use and playwright.") from exc

    # 1. Orq.ai router
    orq_api_key = os.getenv("ORQ_API_KEY")
    if orq_api_key:
        base_url = os.getenv("ORQ_BASE_URL", "https://api.orq.ai/v3/router")
        model = os.getenv("ORQ_MODEL", "alibaba/qwen3.6-flash")
        return ChatOpenAI(
            base_url=base_url,
            api_key=orq_api_key,
            model=model,
            temperature=0.0,
        )

    # 2. OpenRouter provider
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_api_key:
        model = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        return ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_api_key,
            model=model,
            temperature=0.0,
        )

    # 3. OpenAI direct
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key:
        model = os.getenv("LLM_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
        return ChatOpenAI(
            api_key=openai_api_key,
            model=model,
            temperature=0.0,
        )

    # 4. Anthropic direct
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_api_key:
        try:
            from langchain_anthropic import ChatAnthropic
            model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
            return ChatAnthropic(
                api_key=anthropic_api_key,
                model_name=model,
                temperature=0.0,
            )
        except ImportError:
            pass

    # 5. Hermes Agent / Local Ollama / Custom OpenAI-compatible endpoint
    llm_base_url = os.getenv("LLM_BASE_URL", os.getenv("HERMES_AGENT_URL", os.getenv("OLLAMA_BASE_URL", "")))
    if llm_base_url:
        base_url = llm_base_url if llm_base_url.endswith("/v1") else f"{llm_base_url.rstrip('/')}/v1"
        model = os.getenv("LLM_MODEL", os.getenv("HERMES_MODEL", "hermes3:8b"))
        api_key = os.getenv("LLM_API_KEY", os.getenv("HERMES_API_KEY", "ollama"))
        return ChatOpenAI(
            base_url=base_url,
            api_key=api_key,
            model=model,
            temperature=0.0,
        )

    # Fallback to standard ChatOpenAI default env vars
    default_model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    return ChatOpenAI(model=default_model, temperature=0.0)


def _extract_history(history) -> AgentResult:
    """Best-effort extraction of useful fields from a browser-use history object."""
    summary = ""
    visited_urls: List[str] = []
    actions: List[str] = []
    success = True

    try:
        summary = history.final_result() or ""
    except Exception:
        summary = ""

    try:
        success = bool(history.is_done())
    except Exception:
        success = bool(summary)

    step_errors: List[str] = []
    try:
        step_errors = [str(e) for e in history.errors() if e]
    except Exception:
        step_errors = []

    try:
        visited_urls = [u for u in history.urls() if u]
    except Exception:
        visited_urls = []

    try:
        for thought in history.model_thoughts():
            text = getattr(thought, "next_goal", None) or str(thought)
            if text:
                actions.append(text)
    except Exception:
        actions = []

    error_msg: Optional[str] = None
    task_failed = not summary and not success
    if step_errors and task_failed:
        unique_errors = list(dict.fromkeys(step_errors))
        error_msg = unique_errors[-1]
        success = False

    if not summary:
        if error_msg:
            summary = "The agent could not complete the task due to an error."
        else:
            summary = (
                "The agent finished but did not return a textual summary. "
                "Check the action log for details."
            )

    seen = set()
    deduped_urls = []
    for url in visited_urls:
        if url not in seen:
            seen.add(url)
            deduped_urls.append(url)

    return AgentResult(
        instruction="",
        success=success,
        summary=summary,
        visited_urls=deduped_urls,
        actions=actions,
        error=error_msg,
    )


async def run_browser_agent(
    instruction: str,
    max_steps: int = DEFAULT_MAX_STEPS,
    on_step: Optional[Callable] = None,
) -> AgentResult:
    """Run the browser-use agent for a single natural language instruction."""
    instruction = (instruction or "").strip()
    if not instruction:
        return AgentResult(
            instruction=instruction,
            success=False,
            summary="Please provide an instruction for the agent to carry out.",
        )

    try:
        llm = get_llm()
    except Exception as exc:
        return AgentResult(
            instruction=instruction,
            success=False,
            summary="LLM Configuration error.",
            error=str(exc),
        )

    try:
        from browser_use import Agent
        agent = Agent(task=instruction, llm=llm, register_new_step_callback=on_step)
        history = await agent.run(max_steps=max_steps)
        result = _extract_history(history)
        result.instruction = instruction
        return result
    except Exception as exc:
        return AgentResult(
            instruction=instruction,
            success=False,
            summary="The agent hit an error while browsing.",
            error=str(exc),
        )


if __name__ == "__main__":
    import asyncio

    demo_task = "Find the latest news about AI agents and summarize the top 3 stories."
    outcome = asyncio.run(run_browser_agent(demo_task))
    print(outcome.to_markdown())
