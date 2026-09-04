"""C1 first slice: vision-fallback decision logic (mocked screenshots/VLM)."""
import pytest

from app.services.vision_fallback import (
    ALLOWED_VISION_ACTION_KINDS,
    VisionCandidate,
    build_visual_action_annotation,
    compress_snapshot,
    decide_vision_fallback,
    ground_via_vlm,
)


def test_high_confidence_allowlisted_action_proceeds():
    cand = VisionCandidate(x=0.5, y=0.4, confidence=0.9, action_kind="click", label="Apply button")
    out = decide_vision_fallback(cand, url_allowed=True)
    assert out["decision"] == "proceed"
    assert out["source"] == "vision-fallback"
    assert out["confidence"] == 0.9
    assert "click" in ALLOWED_VISION_ACTION_KINDS


def test_low_confidence_yields_handoff_not_click():
    cand = VisionCandidate(x=0.5, y=0.4, confidence=0.2, action_kind="click")
    out = decide_vision_fallback(cand, url_allowed=True)
    assert out["decision"] == "handoff"
    assert out["reason"] == "vision_low_confidence"


def test_unallowlisted_action_kind_yields_handoff():
    for kind in ("submit", "fill", "javascript", "password"):
        out = decide_vision_fallback(
            VisionCandidate(x=0.5, y=0.5, confidence=0.99, action_kind=kind),
            url_allowed=True,
        )
        assert out["decision"] == "handoff", kind
        assert "not_allowlisted" in out["reason"]


def test_disallowed_url_and_sensitive_field_yield_handoff():
    cand = VisionCandidate(x=0.5, y=0.5, confidence=0.99, action_kind="click")
    assert decide_vision_fallback(cand, url_allowed=False)["decision"] == "handoff"
    assert decide_vision_fallback(cand, url_allowed=True, sensitive_detected=True)["reason"] == (
        "vision_sensitive_field_requires_handoff"
    )


def test_none_candidate_and_bad_coords_handoff():
    assert decide_vision_fallback(None, url_allowed=True)["reason"] == "vision_grounding_unavailable"
    bad = VisionCandidate(x=1.5, y=0.5, confidence=0.99, action_kind="click")
    assert decide_vision_fallback(bad, url_allowed=True)["reason"] == "vision_bad_coordinates"


def test_annotation_shape_and_snapshot_compresses_small():
    ann = build_visual_action_annotation(x=0.5, y=0.4, confidence=0.88, action_kind="click")
    assert ann["source"] == "vision-fallback"
    assert set(("x", "y", "confidence", "source")) <= set(ann)
    # ponytail: generate a real PNG in-memory so the test never needs fixtures
    from PIL import Image

    import io

    img = Image.new("RGB", (1280, 800), color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    thumb = compress_snapshot(buf.getvalue())
    assert thumb is not None
    assert len(thumb) < len(buf.getvalue())


@pytest.mark.asyncio
async def test_ground_via_vlm_fail_closed_without_model(monkeypatch):
    monkeypatch.delenv("VISION_GROUNDING_MODEL", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    assert await ground_via_vlm(b"fake-bytes", target_description="Apply") is None


@pytest.mark.asyncio
async def test_worker_vision_click_executes_coordinates():
    from app.services.browser_worker_pool import BrowserWorker
    from unittest.mock import AsyncMock, MagicMock
    worker = BrowserWorker(run_id="r-exec", user_id="u1", target_url="https://boards.greenhouse.io/a/j/1")
    worker.scan_for_sensitive_fields = AsyncMock(return_value=None)  # type: ignore[attr-defined]
    fake_mouse = MagicMock()
    fake_mouse.click = AsyncMock()
    fake_page = MagicMock()
    fake_page.screenshot = AsyncMock(return_value=None)
    fake_page.url = "https://boards.greenhouse.io/a/j/1"
    fake_page.viewport_size = {"width": 1280, "height": 800}
    fake_page.mouse = fake_mouse
    worker.page = fake_page  # type: ignore[assignment]
    out = await worker.run_vision_fallback(
        selector="#apply",
        action_kind="click",
        screenshot_override=b"x",
        grounding_override=VisionCandidate(x=0.3, y=0.3, confidence=0.9, action_kind="click"),
    )
    assert out["outcome"] == "visual_action"
    assert out.get("executed") is True
    fake_mouse.click.assert_awaited_once()
    args = fake_mouse.click.await_args.args
    assert abs(args[0] - 384) < 2 and abs(args[1] - 240) < 2


@pytest.mark.asyncio
async def test_worker_fallback_proceed_and_handoff_paths():
    from app.services.browser_worker_pool import BrowserWorker

    from PIL import Image

    import io

    img = Image.new("RGB", (1280, 800), color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    shot = buf.getvalue()

    worker = BrowserWorker(run_id="r1", user_id="u1", target_url="https://boards.greenhouse.io/a/j/1")
    # ponytail: unittest.mock is a submodule — must import it explicitly, bare `import unittest` has no `.mock`.
    from unittest.mock import AsyncMock
    worker.scan_for_sensitive_fields = AsyncMock(return_value=None)  # type: ignore[attr-defined]

    ok = await worker.run_vision_fallback(
        selector="#apply",
        action_kind="click",
        screenshot_override=shot,
        grounding_override=VisionCandidate(x=0.3, y=0.3, confidence=0.9, action_kind="click"),
    )
    assert ok["outcome"] == "visual_action"
    kinds = [e["type"] for e in worker.events]
    assert "visual_action" in kinds
    payload = next(e for e in worker.events if e["type"] == "visual_action")["payload"]
    assert payload["annotation"]["source"] == "vision-fallback"
    assert "full base64 PNG" not in str(payload)
    assert "snapshot_jpeg" in payload  # downscaled JPEG thumbnail, not full PNG

    worker2 = BrowserWorker(run_id="r2", user_id="u1", target_url="https://boards.greenhouse.io/a/j/1")
    worker2.scan_for_sensitive_fields = __import__("unittest").mock.AsyncMock(return_value=None)  # type: ignore[attr-defined]
    out = await worker2.run_vision_fallback(
        selector="#apply",
        action_kind="click",
        screenshot_override=shot,
        grounding_override=VisionCandidate(x=0.3, y=0.3, confidence=0.1, action_kind="click"),
    )
    assert out["outcome"] == "handoff"
    assert worker2.is_paused is True
    assert any(e["type"] == "pause_required" for e in worker2.events)
