#!/usr/bin/env python3
"""Verify required database migrations are shipped in the self-hosted init bundle."""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "backend" / "db" / "migrations"
INIT_DIR = ROOT / "supabase-local" / "volumes" / "db" / "init"
COMPOSE = ROOT / "supabase-local" / "docker-compose.yml"

REQUIRED = {
    "0002_tayari_core_architecture.sql": "25-0002_tayari_core_architecture.sql",
    "20260812_01_omnisave_vector_dims.sql": "26-20260812_omnisave_vector_dims.sql",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    problems: list[str] = []
    compose_text = COMPOSE.read_text(encoding="utf-8")

    for migration_name, init_name in REQUIRED.items():
        migration = MIGRATIONS / migration_name
        init_copy = INIT_DIR / init_name
        if not migration.is_file():
            problems.append(f"missing canonical migration: {migration}")
            continue
        if not init_copy.is_file():
            problems.append(f"missing self-hosted mirror: {init_copy}")
            continue
        if sha256(migration) != sha256(init_copy):
            problems.append(f"mirror differs from canonical migration: {init_name}")
        if init_name not in compose_text:
            problems.append(f"self-hosted Compose does not mount: {init_name}")

    if problems:
        print("Self-hosted migration bundle verification failed:", file=sys.stderr)
        for problem in problems:
            print(f"- {problem}", file=sys.stderr)
        return 1

    print(f"Self-hosted migration bundle verified ({len(REQUIRED)} required mirrored migrations).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())