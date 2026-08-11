"""Browser automation agent powered by browser-use + Playwright + Multi-Provider LLMs.

This module provides system-level browser automation execution for Tayari AI Engine.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from dotenv import load_dotenv

from app.services.browser_automation.origin_guard import (
    OriginGuardError,
    assert_origin_for_credential_entry,
    credential_field_heuristic,
)
from app.services.browser_automation.session import (
    close_session,
    is_cancelled,
    open_session,
)


logger = logging.getLogger(__name__)

load_dotenv()

DEFAULT_MAX_STEPS = int(os.getenv("AGENT_MAX_STEPS", "25"))


def _allowed_origins() -> list[str]:
    """Parse ``BROWSER_ALLOWED_ORIGINS`` (comma-separated) into a list.

    When unset, the list is empty — only the run's start origin is then
    permitted for credential entry (see ``assert_origin_for_credential_entry``).
    """
    raw = os.getenv("BROWSER_ALLOWED_ORIGINS", "").strip()
    return [o.strip() for o in raw.split(",") if o.strip()]


_START_URL_RE = re.compile(r"https?://[^\s'\"<>]+", re.IGNORECASE)


def _start_url_from_instruction(instruction: str) -> str:
    """Extract the first URL mentioned in the instruction as the run's start origin.

    The browser agent's instructions open with "Navigate to <url>. ..."; that
    URL is the only origin the agent is implicitly trusted to enter
    credentials on. Falling back to an empty string means the guard will block
    *every* credential fill (fail-closed) when no URL can be parsed.
    """
    if not instruction:
        return ""
    match = _START_URL_RE.search(instruction)
    return match.group(0) if match else ""


def _action_target_label(state, action_dump: dict) -> str:
    """Best-effort label for the element an ``input_text`` action targets.

    The browser-use step callback hands us ``(state, model_output, step)`` where
    ``model_output.action`` is a list of ``ActionModel``. Each action dump is
    shaped like ``{"input_text": {"index": 1, "text": "..."}}``. The ``index``
    keys into ``state.selector_map``; the mapped ``DOMElementNode`` carries
    attributes (``aria-label`` / ``placeholder`` / ``id`` / ``name``) we read
    as a credential-label hint. Returns "" when we cannot resolve one.
    """
    selector_map = getattr(state, "selector_map", None) or {}
    for _key, params in (action_dump or {}).items():
        if not isinstance(params, dict):
            continue
        index = params.get("index")
        if index is None:
            continue
        node = selector_map.get(index)
        if node is None:
            continue
        attrs = getattr(node, "attributes", None) or {}
        for field in ("aria-label", "placeholder", "name", "id"):
            val = attrs.get(field)
            if val:
                return str(val)
        # A password-type input with no label attributes must still count as
        # a credential target — the heuristic regex matches "password" here.
        if (attrs.get("type") or "").lower() == "password":
            return "<input type=password>"
    # No usable label: return "" so the caller treats the element as
    # credential-sensitive and asserts the origin (fail-closed). A tag-only
    # label like "<input>" must NOT be returned — the heuristic would read it
    # as non-credential and let a fill on a foreign origin through.
    return ""


def _guard_credential_entry(state, model_output, start_url: str, allowed_origins: list[str]) -> None:
    """Flow 6 tier 2 origin guard — fires before any credential fill.

    Inspects each action the model just decided. For ``input_text`` actions
    whose target element label matches ``credential_field_heuristic``, we
    assert the current page origin is in the allowlist. Raising here
    propagates out of ``agent.run()`` and is caught below as
    ``OriginGuardError`` — the action never executes.

    Fail-closed rule: an action whose target element cannot be resolved
    (``_action_target_label`` returned "") is treated as credential-sensitive
    and asserted, so an unlabeled field on a foreign origin can never slip
    past the guard.
    """
    current_url = getattr(state, "url", "") or ""
    actions = getattr(model_output, "action", None) or []
    for action in actions:
        try:
            dump = action.model_dump(exclude_none=True)
        except Exception:
            # Fail-closed: if the action dump cannot be produced we cannot
            # tell whether this is a credential fill — assert the origin.
            logger.warning("origin_guard: action dump failed, asserting origin for %s", current_url)
            assert_origin_for_credential_entry(current_url, start_url, allowed_origins)
            continue
        if "input_text" not in dump:
            # Only credential-fill (input_text) actions are guarded — clicks
            # and other action types are not credential entry points.
            continue
        label = _action_target_label(state, dump)
        if label and not credential_field_heuristic(label):
            continue
        assert_origin_for_credential_entry(current_url, start_url, allowed_origins)


@dataclass
class AgentResult:
    """Structured result returned to the system / API layer."""

    instruction: str
    success: bool
    summary: str
    visited_urls: List[str] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    error: Optional[str] = None
    # WS-02 submission receipts: evidence captured from the final step so a
    # submission can be proven rather than asserted. `final_screenshot` is a
    # base64 PNG when the driver exposed one.
    final_screenshot: Optional[str] = None
    final_url: Optional[str] = None


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


def _build_agent(Agent, instruction: str, llm, callback, session):
    """Construct a browser-use Agent bound to the run's isolated session.

    Remote providers hand back a CDP URL; older/newer browser-use versions
    accept it under different kwargs, so we degrade to the local browser
    rather than failing the run.
    """
    cdp_url = getattr(session, "cdp_url", None)
    if cdp_url:
        for kwarg in ("cdp_url", "browser_session", "wss_url"):
            try:
                return Agent(task=instruction, llm=llm, register_new_step_callback=callback, **{kwarg: cdp_url})
            except TypeError:
                continue
            except Exception:
                raise
        logger.warning("[BrowserAgent] browser-use rejected remote CDP kwargs; using local browser")
    return Agent(task=instruction, llm=llm, register_new_step_callback=callback)


class RunCancelled(Exception):
    """Raised inside the agent loop when the kill switch fires."""


async def run_browser_agent(
    instruction: str,
    max_steps: int = DEFAULT_MAX_STEPS,
    on_step: Optional[Callable] = None,
    run_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    *,
    start_url: Optional[str] = None,
) -> AgentResult:
    """Run the browser-use agent for a single natural language instruction.

    ``start_url`` is the caller-supplied trusted start origin for the
    credential guard. When omitted, it falls back to parsing the first URL
    out of the instruction text (which opens with "Navigate to <url>. ...").
    The explicit URL always wins — instruction text is never trusted to
    override a caller-supplied origin.
    """
    instruction = (instruction or "").strip()
    if not instruction:
        return AgentResult(
            instruction=instruction,
            success=False,
            summary="Please provide an instruction for the agent to carry out.",
        )

    start_url = start_url or _start_url_from_instruction(instruction)
    allowed = _allowed_origins()

    try:
        from browser_use import Agent
    except ImportError as exc:
        return AgentResult(
            instruction=instruction,
            success=False,
            summary="browser-use library is not installed in the environment.",
            error=str(exc),
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

    # WS-02: always observe steps so the final screenshot/URL survive the run,
    # even when the caller passed no callback of its own. Without this the
    # apply path finishes with nothing but a boolean and a submission can
    # never be proven.
    evidence: dict = {"screenshot": None, "url": None}

    def _observe(state, output, step_number):
        # WS-06 kill switch: poll cancellation between steps.
        if is_cancelled(run_id):
            raise RunCancelled(run_id or "")
        # Flow 6 tier 2: block credential entry on disallowed origins BEFORE
        # the action executes. Raising aborts the run; the guard runs first
        # so a credential leak never happens even if the kill switch is idle.
        _guard_credential_entry(state, output, start_url, allowed)
        shot = getattr(state, "screenshot", None)
        if shot:
            evidence["screenshot"] = shot
        url = getattr(state, "url", None)
        if url:
            evidence["url"] = url
        if on_step is not None:
            try:
                on_step(state, output, step_number)
            except Exception as exc:  # a caller's callback must not kill the run
                logger.warning("[BrowserAgent] on_step callback failed: %s", exc)

    session = None
    try:
        session = await open_session(run_id, owner_id)
        agent = _build_agent(Agent, instruction, llm, _observe, session)
        history = await agent.run(max_steps=max_steps)
        result = _extract_history(history)
        result.instruction = instruction
        result.final_screenshot = evidence["screenshot"]
        result.final_url = evidence["url"] or (result.visited_urls[-1] if result.visited_urls else None)
        return result

    except RunCancelled:
        return AgentResult(
            instruction=instruction,
            success=False,
            summary="Run stopped by the user. The browser session was terminated.",
            error="cancelled",
            final_screenshot=evidence["screenshot"],
            final_url=evidence["url"],
        )
    except OriginGuardError as exc:
        logger.warning("[BrowserAgent] Origin guard blocked run: %s", exc)
        return AgentResult(
            instruction=instruction,
            success=False,
            summary=(
                "Blocked by origin guard: the agent was about to enter "
                "credentials on an origin it did not start on. No credentials "
                "were submitted."
            ),
            error="blocked_origin_guard",
            final_screenshot=evidence["screenshot"],
            final_url=evidence["url"],
        )
    except Exception as exc:
        logger.error(f"[BrowserAgent] Failed step execution: {exc}")
        return AgentResult(
            instruction=instruction,
            success=False,
            summary="The agent hit an error while browsing.",
            error=str(exc),
        )
    finally:
        await close_session(session)



async def stream_browser_agent(
    instruction: str,
    max_steps: int = DEFAULT_MAX_STEPS,
    run_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    *,
    start_url: Optional[str] = None,
):
    """Async generator of SSE events for the Glass-Box live browser feed.

    Yields dicts: {"type": "screenshot", "data": <base64 png>, "step": n,
    "url": ..., "title": ...} per agent step, then {"type": "done",
    "result": {...}}. Error events: "ai_service_unavailable" (LLM config) or
    "browser_agent_failed" (run error) — never canned output.

    ``start_url`` is the caller-supplied trusted start origin for the
    credential guard (explicit value wins over instruction-text parsing).
    """
    instruction = (instruction or "").strip()
    if not instruction:
        yield {"type": "error", "error": "invalid_instruction", "message": "instruction is required"}
        return

    start_url = start_url or _start_url_from_instruction(instruction)
    allowed = _allowed_origins()

    try:
        from browser_use import Agent
    except ImportError as exc:
        yield {"type": "error", "error": "browser_agent_failed", "message": f"browser-use not installed: {exc}"}
        return

    try:
        llm = get_llm()
    except Exception as exc:
        yield {"type": "error", "error": "ai_service_unavailable", "message": str(exc)}
        return

    queue: asyncio.Queue = asyncio.Queue()

    def on_step(state, output, step_number):
        if is_cancelled(run_id):
            raise RunCancelled(run_id or "")
        _guard_credential_entry(state, output, start_url, allowed)
        event = {"type": "screenshot", "step": step_number}
        screenshot = getattr(state, "screenshot", None)
        if screenshot:
            event["data"] = screenshot
        url = getattr(state, "url", None)
        title = getattr(state, "title", None)
        if url:
            event["url"] = url
        if title:
            event["title"] = title
        queue.put_nowait(event)

    session = await open_session(run_id, owner_id)
    if session.live_view_url:
        yield {"type": "live_view", "url": session.live_view_url}

    async def run_agent():
        try:
            agent = _build_agent(Agent, instruction, llm, on_step, session)
            history = await agent.run(max_steps=max_steps)
            result = _extract_history(history)
            result.instruction = instruction
            queue.put_nowait({"type": "result", "result": result})
        except RunCancelled:
            queue.put_nowait({"type": "error", "error": "cancelled", "message": "Run stopped by the user."})
        except OriginGuardError as exc:
            logger.warning("[BrowserAgent] Origin guard blocked run: %s", exc)
            queue.put_nowait({
                "type": "error",
                "error": "blocked_origin_guard",
                "message": "The agent was about to enter credentials on an origin it did not start on. No credentials were submitted.",
            })
        except Exception as exc:
            logger.error(f"[BrowserAgent] Failed step execution: {exc}")
            queue.put_nowait({"type": "error", "error": "browser_agent_failed", "message": str(exc)})


    task = asyncio.create_task(run_agent())
    try:
        while True:
            event = await queue.get()
            if event["type"] == "result":
                result = event["result"]
                break
            if event["type"] == "error":
                yield event
                return
            yield event
    except BaseException:
        task.cancel()
        raise
    finally:
        if not task.done():
            task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await close_session(session)


    yield {"type": "done", "result": result.to_markdown()}
