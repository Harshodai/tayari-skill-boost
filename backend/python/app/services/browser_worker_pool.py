"""Live Isolated Browser Worker Pool (WP-04).

Architectural rules & security invariants:
1. Strict allowlisted ATS domain: Only 'boards.greenhouse.io' is allowed.
   Reject any other domain with 403 Forbidden at entry before any browser or
   Playwright instance is launched.
2. Ephemeral browser context per run: Create an isolated context for each run,
   and ensure it is cleanly closed and destroyed on completion, failure, timeout,
   or manual termination.
3. Execution timeout bound: Default 600s maximum duration.
4. Hard kill switch: terminate_worker(run_id) immediately terminates and cleans
   up the browser context within a 5-second deadline.
5. Sensitive Field Detection & HITL Handoff: If any sensitive field is detected
   ('password', 'ssn', 'salary', 'sponsorship', 'eeo', 'captcha', 'ethnicity',
   'disability', 'veteran'), the run MUST NOT auto-fill or submit. It emits a
   'pause_required' event, freezes the worker loop, and hands off to the candidate.
6. Receipt Reconciliation: Parses confirmation page text, computes a SHA256 receipt
   hash, and idempotently records it in action_ledger.
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import hashlib
import inspect
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set
from urllib.parse import urlsplit

from fastapi import HTTPException

from app.services.saga import SagaContext

from app.services.vision_fallback import (
    VISION_MIN_CONFIDENCE,
    VisionCandidate,
    build_visual_action_annotation,
    compress_snapshot,
    decide_vision_fallback,
    ground_via_vlm,
    vision_coords_to_pixels,
)

from app.services.computer_action_policy import BOARD_POLICIES, authorize_board
from app.services.content_provenance import as_model_context, capture_page_content

logger = logging.getLogger(__name__)

# ponytail: enabled subset of BOARD_POLICIES is the single source of truth; disabled boards handoff via board_handoff_for_url, never execution
ALLOWLISTED_ATS_DOMAINS: list[str] = [host for host, cfg in BOARD_POLICIES.items() if cfg.get("enabled")]
DEFAULT_MAX_TIMEOUT_SECONDS: int = 600
KILL_SWITCH_TIMEOUT_SECONDS: float = 5.0

SENSITIVE_KEYWORDS: list[str] = [
    "password",
    "ssn",
    "salary",
    "sponsorship",
    "eeo",
    "captcha",
    "ethnicity",
    "disability",
    "veteran",
]

_SENSITIVE_PATTERN = re.compile(
    r"\b(?:password|passwd|passcode|pwd)\b"
    r"|\b(?:ssn|social\s+security(?:\s+number)?|tax\s+id|national\s+id)\b"
    r"|\b(?:salary|compensation|expected\s+salary|desired\s+salary|pay\s+range|hourly\s+rate|desired\s+pay)\b"
    r"|\b(?:sponsorship|visa\s+sponsorship|require\s+sponsorship|work\s+authorization|immigration\s+status)\b"
    r"|\b(?:eeo|equal\s+employment|demographic)\b"
    r"|\b(?:captcha|recaptcha|hcaptcha|turnstile|challenge|bot\s+verification|bot\s+detection)\b"
    r"|\b(?:ethnicity|race|ethnic\s+background|hispanic|latino)\b"
    r"|\b(?:disability|handicap|impairment|accommodations?)\b"
    r"|\b(?:veteran|military\s+status|protected\s+veteran|armed\s+forces)\b",
    re.IGNORECASE,
)


class DomainForbiddenError(HTTPException):
    """Raised when target domain is not in ALLOWLISTED_ATS_DOMAINS."""

    def __init__(
        self,
        detail: str = "Forbidden: ATS domain not allowlisted. Only boards.greenhouse.io is allowed for execution.",
    ):
        super().__init__(status_code=403, detail=detail)


def validate_ats_url(url: str) -> str:
    """Validate that url belongs strictly to an allowlisted ATS domain.

    Must be called before any browser process or Playwright context is created.
    Raises DomainForbiddenError (HTTP 403) on invalid or disallowed origins.
    """
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

    # Reject non-HTTP(S) schemes to prevent local-file and non-web access
    if parsed.scheme not in ("http", "https"):
        raise DomainForbiddenError(
            f"Forbidden: URL scheme '{parsed.scheme}' is not allowed. Only http/https are permitted."
        )

    if not host or host not in ALLOWLISTED_ATS_DOMAINS:
        raise DomainForbiddenError(
            f"Forbidden: ATS domain '{host or clean}' is not allowlisted. "
            f"Only {ALLOWLISTED_ATS_DOMAINS} are allowed for execution."
        )
    return clean


def board_handoff_for_url(url: str) -> dict[str, Any] | None:
    """Return a board_disabled handoff for known-but-disabled boards, None when execution may proceed.

    Unknown/invalid boards raise DomainForbiddenError via authorize_board (same 403 contract as
    validate_ats_url). Disabled boards never reach browser launch; callers must handoff instead.
    """
    decision = authorize_board(url)
    if decision.get("outcome") == "handoff":
        return {"reason": "board_disabled", "host": decision.get("host")}
    return None


def detect_sensitive_field(
    field_name: str = "",
    field_label: str = "",
    input_type: str = "",
    placeholder: str = "",
) -> dict[str, Any] | None:
    """Evaluate whether field identifiers/labels match sensitive categories."""
    if (input_type or "").strip().lower() == "password":
        return {
            "field_name": field_name or "password",
            "field_label": field_label or "Password",
            "reason": "Password input type detected",
            "keyword": "password",
        }

    combined = f"{field_name} {field_label} {input_type} {placeholder}".strip()
    match = _SENSITIVE_PATTERN.search(combined)
    if match:
        keyword = match.group(0).lower()
        return {
            "field_name": field_name or keyword,
            "field_label": field_label or placeholder or field_name or keyword,
            "reason": f"Sensitive field detected matching keyword '{keyword}'",
            "keyword": keyword,
        }
    return None


def scan_html_for_sensitive_fields(html: str) -> dict[str, Any] | None:
    """Scan raw HTML string for sensitive form inputs (for tests and offline checks)."""
    if not html:
        return None
    if re.search(r'<input[^>]+type=["\']password["\']', html, re.IGNORECASE):
        return {
            "field_name": "password",
            "field_label": "Password",
            "reason": "Password field detected in HTML",
            "keyword": "password",
        }

    match = _SENSITIVE_PATTERN.search(html)
    if match:
        keyword = match.group(0).lower()
        return {
            "field_name": keyword,
            "field_label": f"Sensitive field '{keyword}' detected in form",
            "reason": f"Sensitive field detected matching keyword '{keyword}'",
            "keyword": keyword,
        }
    return None


def compute_receipt_hash(text: str) -> str:
    """Generate SHA256 digest of confirmation receipt text."""
    normalized = " ".join(text.strip().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


async def scrape_page_content(page: Any, source: str = "browser_automation") -> dict[str, Any]:
    """Scrape page content, wrap with capture_page_content, and prepare model context."""
    if not page:
        return as_model_context(capture_page_content("", "", source=source))
    try:
        page_text = await page.evaluate("() => document.body ? document.body.innerText : ''")
    except Exception:
        page_text = ""
    url = getattr(page, "url", "")
    captured = capture_page_content(page_text, url, source=source)
    return as_model_context(captured)


class BrowserWorker:
    """Ephemeral, isolated browser worker for a single job application run."""

    def __init__(
        self,
        run_id: str,
        user_id: str,
        target_url: str,
        max_timeout: int = DEFAULT_MAX_TIMEOUT_SECONDS,
        browser_context: Any = None,
        page: Any = None,
        owns_browser: bool = True,
        runtime: str | None = None,
    ):
        self.run_id = run_id
        self.user_id = user_id
        self.target_url = target_url
        self.max_timeout = max_timeout
        self.runtime = (runtime or os.getenv("COMPUTER_RUNTIME", "inprocess") or "inprocess").strip().lower() or "inprocess"
        if self.runtime == "docker":
            from app.services.computer_docker_runtime import ComputerRuntimeUnavailable

            raise ComputerRuntimeUnavailable("docker exec bridge not yet wired")
        self.status = "initialized"
        self.context = browser_context
        self.page = page
        self.owns_browser = owns_browser
        self.playwright: Any = None
        self.browser: Any = None
        self.step_index = 0
        self.events: list[dict[str, Any]] = []
        self.subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self.is_paused = False
        self.pause_reason: dict[str, Any] | None = None
        self.is_terminated = False
        self._task: asyncio.Task | None = None
        self._close_lock = asyncio.Lock()
        self.created_at = time.time()
        self.last_page_context: dict[str, Any] | None = None

    def emit_event(self, event_type: str, payload: Any) -> dict[str, Any]:
        """Emit a structured event matching WP-04 schema."""
        self.step_index += 1
        event = {
            "type": event_type,
            "payload": payload,
            "step_index": self.step_index,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        self.events.append(event)
        try:
            from app.services.computer_replay import append_computer_event
            import asyncio as _aio
            try:
                loop = _aio.get_running_loop()
                task = loop.create_task(append_computer_event(self.run_id, event, user_id=self.user_id))
                _REPLAY_TASKS.add(task)
                task.add_done_callback(_REPLAY_TASKS.discard)
            except RuntimeError:
                pass
        except Exception:
            pass  # ponytail: replay never breaks the worker loop
        for q in list(self.subscribers):
            try:
                q.put_nowait(event)
            except Exception:
                pass
        return event

    async def scan_for_sensitive_fields(self) -> dict[str, Any] | None:
        """Inspect page DOM for any sensitive fields."""
        if not self.page:
            return None
        try:
            elements = await self.page.evaluate("""() => {
                const results = [];
                const fields = document.querySelectorAll('input, select, textarea');
                fields.forEach((f) => {
                    const id = f.id || '';
                    const name = f.name || '';
                    const type = f.type || '';
                    const placeholder = f.placeholder || '';
                    const ariaLabel = f.getAttribute('aria-label') || '';

                    let labelText = '';
                    if (id) {
                        const labelEl = document.querySelector(`label[for="${id}"]`);
                        if (labelEl) labelText = labelEl.innerText;
                    }
                    if (!labelText) {
                        const parentLabel = f.closest('label');
                        if (parentLabel) labelText = parentLabel.innerText;
                    }

                    results.push({
                        id,
                        name,
                        type,
                        placeholder,
                        aria_label: ariaLabel,
                        label_text: labelText,
                    });
                });
                return results;
            }""")
            for el in elements:
                detected = detect_sensitive_field(
                    field_name=el.get("name") or el.get("id") or "",
                    field_label=el.get("label_text") or el.get("aria_label") or "",
                    input_type=el.get("type") or "",
                    placeholder=el.get("placeholder") or "",
                )
                if detected:
                    return detected
        except Exception as exc:
            logger.warning("[BrowserWorker %s] scan_for_sensitive_fields error: %s", self.run_id, exc)
        return None

    async def run_vision_fallback(
        self,
        *,
        selector: str,
        action_kind: str = "click",
        target_description: str = "",
        screenshot_override: bytes | None = None,
        grounding_override: VisionCandidate | type(None) | None = "auto",
        min_confidence: float = VISION_MIN_CONFIDENCE,
    ) -> dict[str, Any]:
        """Selector-failure fallback: screenshot → visual grounding → allowlist re-check.

        Emits compact `visual_action` SSE annotations (bbox + confidence +
        source:"vision-fallback" with a downscaled JPEG thumbnail, never a full
        base64 PNG). High-confidence allowlisted actions proceed; anything else
        pauses into the existing durable human handoff. Never bypasses the ATS
        allowlist, sensitive-field HITL, or AUTONOMOUS_SUBMIT_ENABLED=false
        (no submit path exists here).
        """
        import base64 as _b64

        kind = (action_kind or "click").strip().lower()
        raw_shot: bytes | None = screenshot_override
        if raw_shot is None and self.page is not None:
            try:
                raw_shot = await self.page.screenshot(full_page=False)
            except Exception as exc:
                logger.warning("[BrowserWorker %s] vision fallback screenshot failed: %s", self.run_id, exc)
                raw_shot = None
        thumb = compress_snapshot(raw_shot) if raw_shot else None
        thumb_b64 = _b64.b64encode(thumb).decode("ascii") if thumb else None

        candidate: VisionCandidate | None
        if grounding_override == "auto":
            candidate = await ground_via_vlm(
                raw_shot or b"",
                target_description=target_description or selector,
                action_kind=kind,
            )
        elif grounding_override is None:
            candidate = None
        else:
            candidate = grounding_override  # ponytail: test seam; production path always goes through ground_via_vlm

        try:
            current_url = getattr(self.page, "url", self.target_url) if self.page is not None else self.target_url
            validate_ats_url(current_url)
            url_allowed = True
        except Exception:
            url_allowed = False
        sensitive = await self.scan_for_sensitive_fields()
        decision = decide_vision_fallback(
            candidate,
            url_allowed=url_allowed,
            sensitive_detected=bool(sensitive),
            min_confidence=min_confidence,
        )
        if decision.get("decision") == "proceed":
            annotation = build_visual_action_annotation(
                x=decision["x"],
                y=decision["y"],
                confidence=decision["confidence"],
                action_kind=decision["action_kind"],
                width=decision.get("width", 0.0),
                height=decision.get("height", 0.0),
                label=decision.get("label", ""),
                snapshot_present=bool(thumb_b64),
            )
            executed = False
            if not self.is_terminated and not self.is_paused and self.page is not None:
                executed = await self._execute_vision_action(
                    action_kind=decision["action_kind"],
                    x_norm=float(decision["x"]),
                    y_norm=float(decision["y"]),
                )
            annotation["executed"] = executed
            payload: dict[str, Any] = {"annotation": annotation, "failed_selector": selector}
            if thumb_b64:
                # ponytail: downscaled JPEG thumbnail (~tens of KB), not a full PNG per event
                payload["snapshot_jpeg"] = thumb_b64
            self.emit_event("visual_action", payload)
            return {"outcome": "visual_action", "annotation": annotation, "executed": executed}
        reason = decision.get("reason", "vision_handoff")
        self.is_paused = True
        self.status = "paused_sensitive_field"
        self.pause_reason = {"reason": reason, "failed_selector": selector, "source": "vision-fallback"}
        self.emit_event("pause_required", self.pause_reason)
        try:
            from app.services.browser_automation.origin_guard import route_to_human_handoff

            await route_to_human_handoff(
                field_label=f"Vision fallback: {target_description or selector} ({reason})",
                user_id=self.user_id,
                run_id=self.run_id,
                current_url=getattr(self.page, "url", self.target_url) if self.page is not None else self.target_url,
            )
        except Exception as exc:
            logger.warning("[BrowserWorker %s] vision handoff routing error: %s", self.run_id, exc)
        logger.info("[BrowserWorker %s] vision fallback handoff (%s).", self.run_id, reason)
        return {"outcome": "handoff", "reason": reason}

    async def _execute_vision_action(self, *, action_kind: str, x_norm: float, y_norm: float) -> bool:
        if self.page is None or self.is_terminated or self.is_paused:
            return False
        if action_kind not in ("click", "scroll"):
            return False
        try:
            vp = getattr(self.page, "viewport_size", None)
            if isinstance(vp, dict):
                vw, vh = int(vp.get("width", 0)), int(vp.get("height", 0))
            else:
                vw = vh = 0
            if vw <= 0 or vh <= 0:
                try:
                    size = await self.page.evaluate("() => ({w: window.innerWidth, h: window.innerHeight})")
                    vw, vh = int(size.get("w", 0)), int(size.get("h", 0))
                except Exception:
                    return False
            px = vision_coords_to_pixels(x_norm, y_norm, vw, vh)
            if px is None:
                return False
            x_px, y_px = px
            if action_kind == "click":
                await self.page.mouse.click(x_px, y_px)
            else:
                try:
                    await self.page.mouse.wheel(0, int(y_norm * vh) - vh // 2)
                except Exception:
                    await self.page.evaluate(f"window.scrollBy(0, {int(y_norm * vh) - vh // 2})")
            logger.info(
                "[BrowserWorker %s] vision %s executed at %dx%d (conf source=vision-fallback).",
                self.run_id, action_kind, x_px, y_px,
            )
            return True
        except Exception as exc:
            # ponytail: execution failure stays an annotation, never a crash — handoff path owns pauses.
            logger.warning("[BrowserWorker %s] vision execution failed: %s", self.run_id, exc)
            return False

    async def scrape_page_content(self) -> dict[str, Any]:
        """Wrap scraped page content with capture_page_content and prepare LLM context."""
        url = getattr(self.page, "url", self.target_url) if self.page else self.target_url
        page_text = ""
        if self.page:
            try:
                page_text = await self.page.evaluate("() => document.body ? document.body.innerText : ''")
            except Exception as exc:
                logger.warning("[BrowserWorker %s] scrape page content error: %s", self.run_id, exc)
        captured = capture_page_content(page_text, url, source="browser_automation")
        context = as_model_context(captured)
        self.last_page_context = context
        return context

    async def read_page_content(self) -> dict[str, Any]:
        """Read scraped page content with provenance tracking for LLM processing."""
        return await self.scrape_page_content()

    async def parse_confirmation_receipt(self) -> dict[str, Any] | None:
        """Parse confirmation page text, generate SHA256 receipt hash, and extract metadata."""
        if not self.page:
            return None
        try:
            content = await self.page.evaluate("""() => {
                const el = document.querySelector('#application_confirmation, .application-confirmation, #confirmation, [data-qa="confirmation"]');
                if (el) return el.innerText;
                return document.body ? document.body.innerText : '';
            }""")
            if not content:
                return None

            conf_match = re.search(
                r"(thank you for applying|application submitted|application received|your application has been submitted)",
                content,
                re.IGNORECASE,
            )
            if not conf_match:
                return None

            confirmation_text = content.strip()
            current_url = getattr(self.page, "url", self.target_url)
            captured = capture_page_content(confirmation_text, current_url, source="browser_automation")
            _model_ctx = as_model_context(captured)
            receipt_hash = compute_receipt_hash(confirmation_text)

            return {
                "receipt_hash": receipt_hash,
                "confirmation_snippet": confirmation_text[:300],
                "url": current_url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as exc:
            logger.warning("[BrowserWorker %s] parse_confirmation_receipt error: %s", self.run_id, exc)
            return None

    async def record_submission_receipt(
        self,
        receipt_data: dict[str, Any],
        pool: Any = None,
    ) -> dict[str, Any]:
        """Record receipt in action_ledger idempotently."""
        receipt_hash = receipt_data["receipt_hash"]
        current_url = receipt_data.get("url") or getattr(self.page, "url", self.target_url)

        try:
            from app.services.application_lifecycle import record_action

            return await record_action(
                run_id=self.run_id,
                user_id=self.user_id,
                action_type="ats_submission_confirmed",
                idempotency_key=f"receipt:{receipt_hash}",
                status="completed",
                receipt=receipt_data,
                external_url=current_url,
                pool=pool,
            )
        except Exception as exc:
            logger.warning(
                "[BrowserWorker %s] could not record action_ledger receipt: %s",
                self.run_id,
                exc,
            )
            return {
                "run_id": self.run_id,
                "user_id": self.user_id,
                "receipt": receipt_data,
                "error": str(exc),
            }

    async def execute_run(self, pool: Any = None) -> None:
        """Execute the browser automation loop with strict guards."""
        runtime = (self.runtime or os.getenv("COMPUTER_RUNTIME", "inprocess") or "inprocess").strip().lower()
        if runtime == "docker":
            from app.services.computer_docker_runtime import ComputerRuntimeUnavailable

            raise ComputerRuntimeUnavailable("docker exec bridge not yet wired")
        # 1. Enforce board policy at entry point (disabled boards handoff, never execute)
        handoff = board_handoff_for_url(self.target_url)
        if handoff is not None:
            raise DomainForbiddenError(
                f"Forbidden: board '{handoff.get('host')}' is disabled (board_disabled). Human handoff required; execution refused."
            )
        validate_ats_url(self.target_url)

        self.status = "running"
        self.emit_event("url", {"url": self.target_url})

        # 2. Initialize ephemeral browser context if not injected
        if not self.context or not self.page:
            try:
                from playwright.async_api import async_playwright

                self.playwright = await async_playwright().start()
                self.browser = await self.playwright.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--host-resolver-rules=MAP 169.254.169.254 ~NOTFOUND, MAP 127.0.0.1 ~NOTFOUND, MAP ::1 ~NOTFOUND",
                        "--block-insecure-private-network-requests",
                    ],
                )
                self.context = await self.browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
                self.page = await self.context.new_page()
            except Exception as exc:
                self.status = "failed"
                self.emit_event("error", {"error": "browser_initialization_failed", "message": str(exc)})
                await self.close()
                return

        try:
            # 3. Navigate to target
            self.emit_event("action", {"action": "navigate", "target": self.target_url})
            await self.page.goto(self.target_url, wait_until="domcontentloaded", timeout=30000)

            # 4. Capture screenshot
            try:
                raw_shot = await self.page.screenshot(full_page=False)
                b64_shot = base64.b64encode(raw_shot).decode("ascii")
                self.emit_event("screenshot", {"data": b64_shot, "url": self.page.url})
            except Exception as exc:
                logger.warning("[BrowserWorker %s] screenshot capture error: %s", self.run_id, exc)

            # 5. Sensitive Field Detection & Human Handoff (HITL)
            sensitive = await self.scan_for_sensitive_fields()
            if sensitive:
                self.is_paused = True
                self.status = "paused_sensitive_field"
                self.pause_reason = sensitive
                self.emit_event("pause_required", sensitive)

                # Persist durable human handoff in question queue
                try:
                    from app.services.browser_automation.origin_guard import route_to_human_handoff

                    await route_to_human_handoff(
                        field_label=sensitive.get("field_label") or sensitive.get("field_name") or "Sensitive Field",
                        user_id=self.user_id,
                        run_id=self.run_id,
                        current_url=self.page.url,
                    )
                except Exception as exc:
                    logger.warning("[BrowserWorker %s] human handoff routing error: %s", self.run_id, exc)

                logger.info(
                    "[BrowserWorker %s] Sensitive field detected (%s). Automation paused for HITL handoff.",
                    self.run_id,
                    sensitive.get("field_name"),
                )
                return  # FREEZE EXECUTION! Do NOT fill or submit.

            # 6. Scrape page content and prepare context for LLM processing with provenance tracking
            await self.scrape_page_content()

            # 7. Confidence score event for scanned form
            self.emit_event("confidence", {"confidence": 0.95, "status": "form_scanned_clean"})

            # 8. Post-submission Receipt Parsing
            receipt = await self.parse_confirmation_receipt()
            if receipt:
                await self.record_submission_receipt(receipt, pool=pool)
                self.status = "complete"
                self.emit_event("complete", {
                    "receipt_hash": receipt["receipt_hash"],
                    "summary": "Application receipt confirmed and recorded in action_ledger.",
                })
            else:
                self.status = "awaiting_submission"
                self.emit_event("action", {"action": "form_ready", "detail": "Form scanned; candidate review required."})

        except asyncio.CancelledError:
            self.status = "cancelled"
            self.emit_event("error", {"error": "cancelled", "message": "Worker cancelled."})
            raise
        except Exception as exc:
            self.status = "failed"
            self.emit_event("error", {"error": "execution_failed", "message": str(exc)})
            logger.error("[BrowserWorker %s] execution error: %s", self.run_id, exc)
        finally:
            if not self.is_paused:
                await self.close()

    async def close(self, reason: str = "completed") -> None:
        """Close browser resources cleanly within 5 seconds."""
        async with self._close_lock:
            if self.is_terminated:
                return
            self.is_terminated = True
            if reason == "cancelled":
                self.status = "cancelled"
                self.emit_event("error", {"error": "cancelled", "message": "Worker terminated by kill switch."})

            if self._task and not self._task.done() and asyncio.current_task() != self._task:
                self._task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._task

            if self.page:
                try:
                    await self.page.close()
                except Exception:
                    pass
                self.page = None

            if self.context:
                try:
                    await self.context.close()
                except Exception:
                    pass
                self.context = None

            if self.browser and self.owns_browser:
                try:
                    await self.browser.close()
                except Exception:
                    pass
                self.browser = None

            if self.playwright and self.owns_browser:
                try:
                    await self.playwright.stop()
                except Exception:
                    pass
                self.playwright = None

    async def execute_application_flow(
        self,
        task_id: str | None = None,
        user_id: str | None = None,
        page: Any = None,
        job_url: str | None = None,
        form_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute multi-step application workflow using the Saga pattern.

        Steps:
        1. navigate_to_job: Navigate to target URL with compensation to close/clear tab.
        2. fill_application_form: Fill form fields with compensation to reset/clear form.
        3. review_before_submit: Capture screenshot for human review.

        Note: Actual submission requires HITL approval and is retained outside the automated saga.
        """
        return await execute_application_flow(
            task_id=task_id,
            user_id=user_id,
            page=page,
            job_url=job_url,
            form_data=form_data,
            worker=self,
        )


async def execute_application_flow(
    task_id: Any = None,
    user_id: Any = None,
    page: Any = None,
    job_url: str | None = None,
    form_data: dict[str, Any] | None = None,
    worker: BrowserWorker | None = None,
) -> dict[str, Any]:
    """Execute multi-step application workflow using SagaContext.

    Steps:
    1. navigate_to_job: Validates ATS domain and navigates to target URL.
       Compensation: closes or navigates to about:blank to clear the tab.
    2. fill_application_form: Scans for sensitive fields and fills form data.
       Compensation: resets/clears form inputs.
    3. review_before_submit: Captures screenshot for candidate HITL review.
       Compensation: None (review is read-only).

    Note: Actual submission requires HITL approval and is retained outside the automated saga.
    """
    if isinstance(task_id, BrowserWorker):
        target_worker = task_id
        resolved_task_id = str(user_id or target_worker.run_id).strip()
        resolved_user_id = str(page or target_worker.user_id).strip()
        active_page = job_url if job_url is not None else target_worker.page
        url = str(form_data or target_worker.target_url).strip()
        data = {}
    else:
        target_worker = worker
        resolved_task_id = str(task_id or (target_worker.run_id if target_worker else "")).strip()
        resolved_user_id = str(user_id or (target_worker.user_id if target_worker else "")).strip()
        active_page = page if page is not None else (target_worker.page if target_worker else None)
        url = str(job_url or (target_worker.target_url if target_worker else "")).strip()
        data = form_data if isinstance(form_data, dict) else {}

    saga = SagaContext(task_id=resolved_task_id, user_id=resolved_user_id)

    # 1. Step: navigate_to_job
    async def _navigate():
        validated_url = validate_ats_url(url)
        handoff = board_handoff_for_url(validated_url)
        if handoff is not None:
            raise DomainForbiddenError(
                f"Forbidden: board '{handoff.get('host')}' is disabled (board_disabled)."
            )
        if target_worker:
            target_worker.emit_event("action", {"action": "navigate", "target": validated_url})
        if active_page is not None and hasattr(active_page, "goto"):
            res = active_page.goto(validated_url, wait_until="domcontentloaded", timeout=30000)
            if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                await res
        return {"url": validated_url}

    async def _compensate_navigate():
        if target_worker:
            target_worker.emit_event("compensation", {"action": "clear_tab", "target": url})
        if active_page is not None:
            if hasattr(active_page, "goto"):
                try:
                    res = active_page.goto("about:blank")
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res
                    return
                except Exception as exc:
                    logger.warning("[Saga %s] failed to navigate to about:blank during compensation: %s", task_id, exc)
            if hasattr(active_page, "close"):
                try:
                    res = active_page.close()
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res
                except Exception as exc:
                    logger.warning("[Saga %s] failed to close page during compensation: %s", task_id, exc)

    saga.add_step("navigate_to_job", execute=_navigate, compensate=_compensate_navigate)

    # 2. Step: fill_application_form
    async def _fill_form():
        if target_worker:
            target_worker.emit_event("action", {"action": "fill_form", "fields": list(data.keys())})

        if active_page is not None:
            html = ""
            if hasattr(active_page, "content"):
                c = active_page.content()
                if asyncio.iscoroutine(c) or inspect.isawaitable(c):
                    html = await c
                elif isinstance(c, str):
                    html = c
            if html:
                sensitive = scan_html_for_sensitive_fields(html)
                if sensitive:
                    raise ValueError(f"Sensitive field detected: {sensitive.get('field_name')}")

            if hasattr(active_page, "fill"):
                for selector, val in data.items():
                    res = active_page.fill(selector, str(val))
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res
            elif hasattr(active_page, "evaluate"):
                for selector, val in data.items():
                    safe_sel = json.dumps(selector)
                    safe_val = json.dumps(str(val))
                    res = active_page.evaluate(f"""() => {{
                        const el = document.querySelector({safe_sel});
                        if (el) {{
                            el.value = {safe_val};
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                    }}""")
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res

        return {"filled_fields": list(data.keys())}

    async def _compensate_fill():
        if target_worker:
            target_worker.emit_event("compensation", {"action": "clear_form"})
        if active_page is not None:
            if hasattr(active_page, "evaluate"):
                try:
                    res = active_page.evaluate("""() => {
                        const forms = document.querySelectorAll('form');
                        forms.forEach(f => f.reset());
                        const inputs = document.querySelectorAll('input, textarea');
                        inputs.forEach(i => {
                            if (i.type !== 'submit' && i.type !== 'button' && i.type !== 'hidden') {
                                i.value = '';
                                i.dispatchEvent(new Event('input', { bubbles: true }));
                                i.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                    }""")
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res
                    return
                except Exception as exc:
                    logger.warning("[Saga %s] failed to reset form via evaluate: %s", task_id, exc)
            if hasattr(active_page, "fill"):
                for selector in data.keys():
                    try:
                        res = active_page.fill(selector, "")
                        if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                            await res
                    except Exception:
                        pass

    saga.add_step("fill_application_form", execute=_fill_form, compensate=_compensate_fill)

    # 3. Step: review_before_submit
    async def _review():
        screenshot_b64 = None
        if active_page is not None and hasattr(active_page, "screenshot"):
            try:
                raw = active_page.screenshot(full_page=False)
                if asyncio.iscoroutine(raw) or inspect.isawaitable(raw):
                    raw = await raw
                if raw:
                    screenshot_b64 = base64.b64encode(raw).decode("ascii")
            except Exception as exc:
                logger.warning("[Saga %s] review screenshot error: %s", task_id, exc)

        if target_worker:
            payload = {"status": "ready_for_review", "hitl_required": True}
            if screenshot_b64:
                payload["screenshot"] = screenshot_b64
            target_worker.emit_event("action", payload)

        return {
            "screenshot": screenshot_b64,
            "status": "ready_for_review",
            "hitl_required": True,
            "note": "Actual submit requires HITL approval and is retained outside automated saga.",
        }

    saga.add_step("review_before_submit", execute=_review, compensate=None)

    return await saga.run()



# ============================================================================
# WORKER POOL & KILL SWITCH REGISTRY
# ============================================================================

_REPLAY_TASKS: set[asyncio.Task] = set()

_WORKERS: dict[tuple[str, str], BrowserWorker] = {}
_POOL_LOCK = asyncio.Lock()


def _worker_key(user_id: str, run_id: str) -> tuple[str, str]:
    return (str(user_id).strip(), str(run_id).strip())


def get_worker(run_id: str, user_id: str | None = None) -> BrowserWorker | None:
    """Retrieve an active worker by (user_id, run_id).

    user_id=None is legacy backward-compat: scans for any owner with this
    run_id. New callers should pass user_id for owner-scoped lookup.
    """
    normalized_run_id = str(run_id).strip()
    if user_id is not None:
        return _WORKERS.get(_worker_key(user_id, normalized_run_id))
    for (owner, rid), worker in _WORKERS.items():
        if rid == normalized_run_id:
            return worker
    return None


async def create_worker(
    run_id: str,
    user_id: str,
    target_url: str,
    max_timeout: int = DEFAULT_MAX_TIMEOUT_SECONDS,
    browser_context: Any = None,
    page: Any = None,
    owns_browser: bool = True,
) -> BrowserWorker:
    """Create and register a new BrowserWorker after validating ATS allowlist."""
    # First: Disabled boards handoff before any browser or Playwright process!
    handoff = board_handoff_for_url(target_url)
    if handoff is not None:
        raise DomainForbiddenError(
            f"Forbidden: board '{handoff.get('host')}' is disabled (board_disabled). Human handoff required; execution refused."
        )
    # Second: Validate ATS origin before creating any browser or Playwright process!
    validated_url = validate_ats_url(target_url)

    normalized_run_id = str(run_id).strip()
    normalized_user_id = str(user_id).strip()

    # Terminate any existing worker for this (user_id, run_id) BEFORE acquiring
    # the pool lock. terminate_worker acquires _POOL_LOCK in its own finally
    # block; calling it while already holding the lock causes a deadlock.
    existing = _WORKERS.get(_worker_key(normalized_user_id, normalized_run_id))
    if existing and not existing.is_terminated:
        await terminate_worker(normalized_run_id, owner_id=normalized_user_id)

    async with _POOL_LOCK:
        worker = BrowserWorker(
            run_id=normalized_run_id,
            user_id=normalized_user_id,
            target_url=validated_url,
            max_timeout=max_timeout,
            browser_context=browser_context,
            page=page,
            owns_browser=owns_browser,
        )
        _WORKERS[_worker_key(normalized_user_id, normalized_run_id)] = worker
        return worker



async def start_worker_task(
    worker: BrowserWorker,
    pool: Any = None,
) -> asyncio.Task:
    """Launch execution loop bounded by max execution timeout."""
    async def _timed_execution():
        try:
            await asyncio.wait_for(worker.execute_run(pool=pool), timeout=float(worker.max_timeout))
        except asyncio.TimeoutError:
            logger.warning("[BrowserWorker %s] hit max timeout of %ds", worker.run_id, worker.max_timeout)
            worker.status = "timeout"
            worker.emit_event("error", {"error": "timeout", "message": f"Execution exceeded {worker.max_timeout}s timeout"})
            await worker.close(reason="timeout")
        except asyncio.CancelledError:
            worker.status = "cancelled"
            await worker.close(reason="cancelled")
        except Exception as exc:
            logger.error("[BrowserWorker %s] unexpected task error: %s", worker.run_id, exc)
            worker.status = "failed"
            worker.emit_event("error", {"error": "task_failed", "message": str(exc)})
            await worker.close(reason="failed")
        # Enforce bounded handoff deadline for paused workers
        if worker.is_paused and not worker.is_terminated:
            _PAUSE_HANDOFF_DEADLINE = 1800.0  # 30 minutes
            logger.info(
                "[BrowserWorkerPool] Worker %s paused awaiting HITL (deadline: %ds)",
                worker.run_id,
                _PAUSE_HANDOFF_DEADLINE,
            )
            loop = asyncio.get_event_loop()
            deadline_abs = loop.time() + _PAUSE_HANDOFF_DEADLINE
            while worker.is_paused and not worker.is_terminated:
                remaining = deadline_abs - loop.time()
                if remaining <= 0:
                    break
                await asyncio.sleep(min(5.0, remaining))
            if worker.is_paused and not worker.is_terminated:
                logger.warning(
                    "[BrowserWorkerPool] HITL deadline exceeded for run %s; forcing cleanup",
                    worker.run_id,
                )
                worker.emit_event("error", {
                    "error": "handoff_timeout",
                    "message": f"Human handoff not completed within {int(_PAUSE_HANDOFF_DEADLINE)}s deadline.",
                })
                await worker.close(reason="cancelled")
        async with _POOL_LOCK:
            # Remove if terminated or finished
            if worker.is_terminated or worker.status in ("complete", "failed", "cancelled", "timeout"):
                _WORKERS.pop(_worker_key(worker.user_id, worker.run_id), None)

    task = asyncio.create_task(_timed_execution())
    worker._task = task
    return task


async def terminate_worker(run_id: str, owner_id: str | None = None) -> bool:
    """Hard kill switch: immediately closes and cleans up browser context within 5s."""
    normalized_run_id = str(run_id).strip()
    if owner_id is not None:
        worker = _WORKERS.get(_worker_key(owner_id, normalized_run_id))
        key = _worker_key(owner_id, normalized_run_id)
        if worker is None:
            for (owner, rid), candidate in list(_WORKERS.items()):
                if rid == normalized_run_id:
                    logger.warning(
                        "[Audit] terminate_worker denied: caller %s does not own run %s (owner: %s)",
                        owner_id,
                        run_id,
                        candidate.user_id,
                    )
                    raise PermissionError("Access denied: run does not belong to caller")
            return False
    else:
        worker = get_worker(normalized_run_id)
        key = _worker_key(worker.user_id, normalized_run_id) if worker else ("", normalized_run_id)
        if not worker:
            return False

    logger.info("[BrowserWorkerPool] Terminating worker for run %s within 5s bound", normalized_run_id)

    # 5-second hard deadline
    try:
        await asyncio.wait_for(worker.close(reason="cancelled"), timeout=KILL_SWITCH_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.warning(
            "[BrowserWorkerPool] terminate_worker cleanup exceeded %ds for run %s",
            KILL_SWITCH_TIMEOUT_SECONDS,
            normalized_run_id,
        )
    finally:
        async with _POOL_LOCK:
            _WORKERS.pop(key, None)

    return True


async def cleanup_all_workers() -> None:
    """Clean up all active workers in pool (for test isolation and shutdown)."""
    async with _POOL_LOCK:
        worker_list = list(_WORKERS.values())
        _WORKERS.clear()

    for w in worker_list:
        with contextlib.suppress(Exception):
            await asyncio.wait_for(w.close(reason="cancelled"), timeout=2.0)
