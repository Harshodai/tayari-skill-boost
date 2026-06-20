"""Telemetry stub — publish pipeline events to logs."""
from .publisher import publish_event, stage_complete, stage_fail

__all__ = ["publish_event", "stage_complete", "stage_fail"]
