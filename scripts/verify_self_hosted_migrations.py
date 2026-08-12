#!/usr/bin/env python3
"""Verify required database migrations are shipped in the self-hosted init bundle.

The self-hosted Supabase database initializes from a curated bundle rather than
automatically globbing canonical migrations. This check fails CI if an essential
schema migration is missing, differs byte-for-byte, or is not mounted by Compose.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ROOT / "supabase-local" / "docker-compose.yml"
REQUIRED_MIRRORS = {
    "backend/db/migrations/0002_tayari_core_architecture.sql": (
        "supabase-local/volumes/db/init/25-0002_tayari_core_architecture.sql",
        "zz-25-0002_tayari_core_architecture.sql",
    ),
    "backend/db/migrations/20260812_01_omnisave_vector_dims.sql": (
        "supabase-local/volumes/db/init/26-20260812_omnisave_vector_dims.sql",
        "zz-26-20260812_omnisave_vector_dims.sql",
    ),
    "backend/db/migrations/20260813_01_durable_run_control_plane.sql": (
        "supabase-local/volumes/db/init/27-20260813_durable_run_control_plane.sql",
        "zz-27-20260813_durable_run_control_plane.sql",
    ),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    compose_text = COMPOSE.read_text(encoding="utf-8")
    failures: list[str] = []

    for source_relative, (bundle_relative, target_name) in REQUIRED_MIRRORS.items():
        source = ROOT / source_relative
        bundle = ROOT / bundle_relative
        if not source.is_file() or not bundle.is_file():
            failures.append(
                f"missing required migration pair: {source_relative} -> {bundle_relative}"
            )
            continue
        if digest(source) != digest(bundle):
            failures.append(f"migration content drift: {source_relative} != {bundle_relative}")
        expected_mount = (
            f"./volumes/db/init/{bundle.name}:"
            f"/docker-entrypoint-initdb.d/migrations/{target_name}:Z"
        )
        if expected_mount not in compose_text:
            failures.append(f"missing Compose mount: {expected_mount}")

    if failures:
        print("Self-hosted migration verification failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(f"Self-hosted migration bundle verified ({len(REQUIRED_MIRRORS)} required mirrored migrations).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
