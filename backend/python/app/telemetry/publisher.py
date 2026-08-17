"""Structured event publisher for the service logging and collection pipeline."""
import logging
import time
from typing import Optional

logger = logging.getLogger("tayari.telemetry")


def publish_event(
    event_name: str,
    trace_id: str,
    payload: Optional[dict] = None,
    latency_ms: Optional[float] = None,
) -> None:
    """Publish a generic structured telemetry event to the service logger."""
    payload = payload or {}
    extra = {"trace_id": trace_id, "event": event_name, **payload}
    if latency_ms is not None:
        extra["latency_ms"] = round(latency_ms, 2)
    logger.info("Telemetry event: %s", event_name, extra=extra)


def stage_complete(
    stage_name: str,
    trace_id: str,
    latency_ms: float,
    status: str = "success",
) -> None:
    """Log a successful stage completion."""
    logger.info(
        "[trace=%s] stage=%s status=%s latency_ms=%.2f",
        trace_id, stage_name, status, latency_ms,
    )


def stage_fail(
    stage_name: str,
    trace_id: str,
    error_type: str,
    error_message: str,
) -> None:
    """Log a stage failure."""
    logger.warning(
        "[trace=%s] stage=%s status=fail error_type=%s error_message=%s",
        trace_id, stage_name, error_type, error_message,
    )
