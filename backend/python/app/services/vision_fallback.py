"""Vision-grounding fallback for selector failures (C1 first slice).

Honest slice: when DOM selectors fail, capture a screenshot and attempt a
clearly-labeled visual grounding that resolves ONLY to allowlisted actions.
Low confidence (or no configured VLM) fails CLOSED to the durable human
handoff — never a guessed click. (The repo previously deleted a
coordinate-faking driver; this module must never regress that.)

Safety boundaries (inviolable):
- Every vision-sourced coordinate is re-validated against the ATS allowlist
  and the action policy before use; source + confidence are logged.
- SUBMISSION-class actions are never authorized here; sensitive fields always
  route to HITL handoff. AUTONOMOUS_SUBMIT_ENABLED=false is never bypassed
  (this module has no submit path at all).
"""

from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# ponytail: keep threshold high and in one place; low confidence means
# handoff, not a guessed click.
VISION_MIN_CONFIDENCE: float = 0.75

# ponytail: vision may only retry inert targeting actions. "fill" is excluded —
# a mis-grounded fill lands in the wrong field (often a sensitive one); the
# DOM path already owns fills. Submission is never a fallback action.
ALLOWED_VISION_ACTION_KINDS: tuple[str, ...] = ("click", "scroll", "observe")

VISION_SOURCE_TAG: str = "vision-fallback"


@dataclass(frozen=True)
class VisionCandidate:
    """A single visual-grounding hypothesis in normalized 0..1 coords."""

    x: float
    y: float
    confidence: float
    action_kind: str = "click"
    label: str = ""
    width: float = 0.0
    height: float = 0.0


def _in_unit_range(value: float) -> bool:
    return isinstance(value, float | int) and 0.0 <= float(value) <= 1.0


def decide_vision_fallback(
    candidate: VisionCandidate | None,
    *,
    url_allowed: bool,
    sensitive_detected: bool = False,
    min_confidence: float = VISION_MIN_CONFIDENCE,
) -> dict[str, Any]:
    """Pure decision: proceed with an allowlisted vision action, or hand off.

    Returns {"decision": "proceed", ...} or {"decision": "handoff", "reason": ...}.
    Fail-closed on every invalid input: None candidate, out-of-range coords,
    low confidence, disallowed kind, disallowed URL, or sensitive field.
    """
    if candidate is None:
        return {"decision": "handoff", "reason": "vision_grounding_unavailable"}
    kind = (candidate.action_kind or "").strip().lower()
    if kind not in ALLOWED_VISION_ACTION_KINDS:
        logger.info(
            "[vision-fallback] handoff: action_kind=%r not allowlisted (source=%s conf=%.3f)",
            candidate.action_kind,
            VISION_SOURCE_TAG,
            candidate.confidence,
        )
        return {"decision": "handoff", "reason": f"vision_action_not_allowlisted:{kind or 'empty'}"}
    if not url_allowed:
        return {"decision": "handoff", "reason": "vision_target_outside_allowlist"}
    if sensitive_detected:
        return {"decision": "handoff", "reason": "vision_sensitive_field_requires_handoff"}
    try:
        conf = float(candidate.confidence)
    except (TypeError, ValueError):
        return {"decision": "handoff", "reason": "vision_bad_confidence"}
    if conf < float(min_confidence):
        logger.info(
            "[vision-fallback] handoff: low confidence %.3f < %.2f (source=%s label=%r)",
            conf,
            min_confidence,
            VISION_SOURCE_TAG,
            candidate.label,
        )
        return {"decision": "handoff", "reason": "vision_low_confidence", "confidence": conf}
    if not _in_unit_range(candidate.x) or not _in_unit_range(candidate.y):
        return {"decision": "handoff", "reason": "vision_bad_coordinates"}
    logger.info(
        "[vision-fallback] proceed: kind=%s conf=%.3f x=%.3f y=%.3f label=%r",
        kind,
        conf,
        float(candidate.x),
        float(candidate.y),
        candidate.label,
    )
    return {
        "decision": "proceed",
        "action_kind": kind,
        "x": float(candidate.x),
        "y": float(candidate.y),
        "width": float(candidate.width) if _in_unit_range(candidate.width) else 0.0,
        "height": float(candidate.height) if _in_unit_range(candidate.height) else 0.0,
        "confidence": conf,
        "source": VISION_SOURCE_TAG,
        "label": candidate.label,
    }


def vision_coords_to_pixels(
    x_norm: float, y_norm: float, viewport_width: int, viewport_height: int
) -> tuple[int, int] | None:
    if viewport_width <= 0 or viewport_height <= 0:
        return None
    try:
        x = float(x_norm)
        y = float(y_norm)
    except (TypeError, ValueError):
        return None
    if not 0.0 <= x <= 1.0 or not 0.0 <= y <= 1.0:
        return None
    # ponytail: round to int px; callers clamp viewport from live page size.
    return (round(x * viewport_width), round(y * viewport_height))


def build_visual_action_annotation(
    *,
    x: float,
    y: float,
    confidence: float,
    action_kind: str = "click",
    width: float = 0.0,
    height: float = 0.0,
    label: str = "",
    snapshot_present: bool = False,
) -> dict[str, Any]:
    """Compact SSE payload for a vision-sourced action (no image bytes here)."""
    return {
        "x": round(float(x), 4),
        "y": round(float(y), 4),
        "width": round(float(width), 4),
        "height": round(float(height), 4),
        "confidence": round(float(confidence), 3),
        "source": VISION_SOURCE_TAG,
        "action_kind": action_kind,
        "label": label,
        "snapshot_present": bool(snapshot_present),
    }


def compress_snapshot(raw_png: bytes, *, max_width: int = 640, quality: int = 60) -> bytes | None:
    """Downscale raw PNG bytes to a small JPEG thumbnail for SSE transport.

    Returns None when PIL is unavailable or the input is unusable — callers
    then emit the annotation WITHOUT a snapshot (never a full base64 PNG).
    """
    if not raw_png:
        return None
    try:
        from PIL import Image  # ponytail: local import so unit tests never need PIL
    except Exception:
        return None
    try:
        with Image.open(io.BytesIO(raw_png)) as img:
            img = img.convert("RGB")
            if img.width > max_width:
                ratio = max_width / float(img.width)
                img = img.resize((max_width, max(1, round(img.height * ratio))), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=int(quality), optimize=True)
            return buf.getvalue()
    except Exception as exc:
        logger.warning("[vision-fallback] snapshot compress failed: %s", exc)
        return None


async def ground_via_vlm(
    screenshot_bytes: bytes,
    *,
    target_description: str,
    action_kind: str = "click",
) -> VisionCandidate | None:
    """MODEL CALL SITE (honestly stubbed): resolve target → normalized coords.

    Fail-closed: when no vision model is configured (VISION_GROUNDING_MODEL /
    LLM_* unset — the usual self-hosted state), returns None so the caller
    takes the handoff path. A real implementation must return a VisionCandidate
    with 0..1 coords + calibrated confidence and NOTHING else is trusted
    downstream (decide_vision_fallback re-validates everything).
    Never fabricate coordinates here.
    """
    _ = (screenshot_bytes, target_description, action_kind)
    model = (os.getenv("VISION_GROUNDING_MODEL") or os.getenv("LLM_MODEL") or "").strip()
    if not model:
        logger.info("[vision-fallback] VLM not configured; failing closed to handoff")
        return None
    # ponytail: provider wiring lands here; until then any configured-but-
    # unwired model still fails closed rather than guessing coordinates.
    logger.warning("[vision-fallback] VLM model %r configured but provider unwired; handoff", model)
    return None
