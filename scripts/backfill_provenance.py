#!/usr/bin/env python3
"""Conservative provenance backfill for historical agent runs.

Dry-run is the default. The script never infers human authorship from missing
AI records. Applied rows are explicitly marked unknown with a stable
idempotency key and evidence that historical provenance was unavailable.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_ROOT = os.path.join(ROOT, "backend", "python")
if PYTHON_ROOT not in sys.path:
    sys.path.insert(0, PYTHON_ROOT)

from app.services.db import get_pool  # noqa: E402
from app.services.provenance import ProvenanceService, ProvenanceUnavailable, payload_hash  # noqa: E402


async def run(*, limit: int, apply: bool) -> dict[str, Any]:
    pool = await get_pool()
    if not pool:
        raise ProvenanceUnavailable("durable provenance storage is unavailable")
    service = ProvenanceService(lambda: pool)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT run_id, user_id, run_type, result, created_at
            FROM public.agent_runs
            WHERE user_id IS NOT NULL
            ORDER BY created_at ASC, run_id ASC
            LIMIT $1
            """,
            max(1, min(limit, 1000)),
        )

    candidates: list[dict[str, Any]] = []
    applied = 0
    skipped = 0
    for row in rows:
        run_id = str(row["run_id"])
        user_id = str(row["user_id"])
        key = f"backfill:agent_run:{run_id}"
        async with pool.acquire() as conn:
            already = await conn.fetchval(
                "SELECT 1 FROM public.artifact_origin_events WHERE user_id = $1 AND idempotency_key = $2",
                user_id,
                key,
            )
        if already:
            skipped += 1
            continue
        result = row["result"]
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except (TypeError, ValueError):
                result = {"unparsed_result": True}
        result_digest = payload_hash(result or {})
        candidate = {
            "run_id": run_id,
            "user_id": user_id,
            "run_type": row["run_type"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "classification": "unknown",
            "reason": "historical_provenance_unavailable",
            "content_hash": result_digest,
        }
        candidates.append(candidate)
        if apply:
            await service.create_artifact(
                user_id=user_id,
                artifact_type="historical_agent_run",
                content_hash=result_digest,
                event_type="failed",
                origin_actor="unknown",
                producer_type="system_import",
                idempotency_key=key,
                metadata={
                    "backfill_source": "agent_runs",
                    "source_id": run_id,
                    "reason": "historical_provenance_unavailable",
                },
                output_hash=result_digest,
                failure_code="historical_provenance_unavailable",
            )
            applied += 1

    return {
        "schema": "tayari.ai-provenance.backfill-report.v1",
        "mode": "apply" if apply else "dry_run",
        "candidate_count": len(candidates),
        "applied_count": applied,
        "skipped_existing_count": skipped,
        "candidates": candidates,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--apply", action="store_true", help="Write explicit unknown records; dry-run is the default")
    args = parser.parse_args()
    try:
        report = asyncio.run(run(limit=args.limit, apply=args.apply))
    except ProvenanceUnavailable as exc:
        print(json.dumps({"status": "blocked", "reason": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
