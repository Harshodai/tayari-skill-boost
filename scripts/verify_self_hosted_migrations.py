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
    "backend/db/migrations/20260817_stripe_webhook_events.sql": (
        "supabase-local/volumes/db/init/35-20260817_stripe_webhook_events.sql",
        "zz-35-20260817_stripe_webhook_events.sql",
    ),
    "backend/db/migrations/20260817_01_ai_provenance.sql": (
        "supabase-local/volumes/db/init/37-20260817_ai_provenance.sql",
        "zz-37-20260817_ai_provenance.sql",
    ),
    "backend/db/migrations/20260817_02_computer_control.sql": (
        "supabase-local/volumes/db/init/38-20260817_computer_control.sql",
        "zz-38-20260817_computer_control.sql",
    ),
    "backend/db/migrations/20260818_03_google_workspace.sql": (
        "supabase-local/volumes/db/init/39-20260818_google_workspace.sql",
        "zz-39-20260818_google_workspace.sql",
    ),
    "backend/db/migrations/20260819_01_agent_automation_notifications.sql": (
        "supabase-local/volumes/db/init/40-20260819_agent_automation_notifications.sql",
        "zz-40-20260819_agent_automation_notifications.sql",
    ),
    "backend/db/migrations/20260820_01_automation_lease_recovery.sql": (
        "supabase-local/volumes/db/init/41-20260820_automation_lease_recovery.sql",
        "zz-41-20260820_automation_lease_recovery.sql",
    ),
    "backend/db/migrations/20260821_01_automation_event_inbox.sql": (
        "supabase-local/volumes/db/init/42-20260821_automation_event_inbox.sql",
        "zz-42-20260821_automation_event_inbox.sql",
    ),
    "backend/db/migrations/20260821_02_task_artifacts.sql": (
        "supabase-local/volumes/db/init/47-20260821_task_artifacts.sql",
        "zz-47-20260821_task_artifacts.sql",
    ),
    "backend/db/migrations/20260821_03_task_control_leases.sql": (
        "supabase-local/volumes/db/init/48-20260821_task_control_leases.sql",
        "zz-48-20260821_task_control_leases.sql",
    ),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    compose_text = COMPOSE.read_text(encoding="utf-8")
    failures: list[str] = []
    init_dir = ROOT / "supabase-local" / "volumes" / "db" / "init"
    hardening = init_dir / "29-20260814_tenant_rls_hardening.sql"
    if not hardening.is_file():
        failures.append("missing tenant RLS hardening migration 29-20260814")
    else:
        text = hardening.read_text(encoding="utf-8")
        if not text.startswith("-- M2-08/M2-09") or "BEGIN;" not in text or "COMMIT;" not in text:
            failures.append("tenant RLS hardening migration is not a transactional, documented migration")
    migration_names = [path.name for path in sorted(init_dir.glob("*.sql"))]
    if migration_names != sorted(migration_names):
        failures.append("self-hosted migrations are not in lexical execution order")
    prefixes = [name.split("-", 1)[0] for name in migration_names if name[:1].isdigit()]
    duplicates = sorted({prefix for prefix in prefixes if prefixes.count(prefix) > 1})
    if duplicates:
        failures.append(f"duplicate self-hosted migration prefixes: {', '.join(duplicates)}")

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
