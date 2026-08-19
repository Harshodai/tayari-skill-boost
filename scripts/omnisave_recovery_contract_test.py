#!/usr/bin/env python3
"""Synthetic OmniSaveAI recovery invariants.

This is a deterministic contract test, not a substitute for killing a real
staging worker. It models the durable invariants that the staging drill must
prove against PostgreSQL, Redis, Celery, and the authenticated browser.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field


@dataclass
class Run:
    status: str = "queued"
    page_count: int = 0
    checkpoint_signature: str | None = None
    lease_until: int | None = None
    imported: int = 0
    failed: int = 0
    cancelled: bool = False
    items: set[str] = field(default_factory=set)


class RecoveryModel:
    def __init__(self) -> None:
        self.run = Run()
        self.now = 0

    def claim(self, lease_seconds: int = 120) -> None:
        if self.run.status == "running" and self.run.lease_until is not None and self.run.lease_until >= self.now:
            raise RuntimeError("lease_not_expired")
        if self.run.cancelled:
            raise RuntimeError("cancelled_run")
        self.run.status = "running"
        self.run.lease_until = self.now + lease_seconds

    def checkpoint(self, page_count: int, signature: str) -> None:
        if self.run.status != "running" or self.run.cancelled:
            raise RuntimeError("run_not_active")
        self.run.page_count = page_count
        self.run.checkpoint_signature = signature

    def ingest(self, source_keys: list[str], failed: bool = False) -> int:
        if self.run.status != "running" or self.run.cancelled:
            raise RuntimeError("run_not_active")
        before = len(self.run.items)
        self.run.items.update(source_keys)
        self.run.imported += len(self.run.items) - before
        if failed:
            self.run.failed += 1
        return len(self.run.items) - before

    def cancel(self) -> None:
        self.run.cancelled = True
        self.run.status = "cancelled"
        self.run.lease_until = None


def retry_delays(statuses: list[int]) -> list[int]:
    delays = [500, 1000, 2000]
    used: list[int] = []
    for attempt, status in enumerate(statuses):
        if status in (429,) or status >= 500:
            if attempt >= len(delays):
                raise RuntimeError("retry_exhausted")
            used.append(delays[attempt])
            continue
        break
    return used


def run() -> dict:
    evidence: dict[str, object] = {"mode": "synthetic", "checks": []}

    model = RecoveryModel()
    model.claim()
    model.ingest(["medium:one", "medium:two"])
    model.checkpoint(1, "page-1")
    model.now = 121
    model.claim()
    assert model.run.page_count == 1 and model.run.checkpoint_signature == "page-1"
    evidence["checks"].append("expired_lease_reclaim_preserves_checkpoint")

    before = model.run.imported
    added = model.ingest(["medium:two", "medium:three"])
    assert added == 1 and model.run.imported == before + 1
    evidence["checks"].append("duplicate_source_key_has_no_duplicate_side_effect")

    assert retry_delays([429, 503, 201]) == [500, 1000]
    assert retry_delays([400]) == []
    evidence["checks"].append("bounded_retry_backoff_is_retryable_only_for_429_and_5xx")

    model.cancel()
    assert model.run.status == "cancelled" and model.run.lease_until is None
    try:
        model.claim()
    except RuntimeError as exc:
        assert str(exc) == "cancelled_run"
    else:
        raise AssertionError("cancelled run was claimable")
    evidence["checks"].append("cancellation_terminates_future_claims")

    evidence["status"] = "PASS"
    evidence["live_staging_required"] = [
        "interrupt a real Celery worker after checkpoint",
        "restart and reclaim the same database run",
        "verify browser session termination on cancellation",
        "observe provider 429/5xx backoff against a gated test endpoint",
    ]
    return evidence


if __name__ == "__main__":
    print(json.dumps(run(), indent=2, sort_keys=True))
    sys.exit(0)
