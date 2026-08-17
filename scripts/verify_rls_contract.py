#!/usr/bin/env python3
"""Verify the repository's authoritative migrations protect tenant/user tables.

This is a static contract, not a substitute for a live two-tenant database test.
It prevents a migration from silently dropping RLS enablement or policies for a
known protected table.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

REQUIRED_TABLES = (
    "profiles",
    "resumes",
    "resume_analyses",
    "tenants",
    "cohorts",
    "memberships",
    "push_subscriptions",
    "application_approvals",
    "submission_receipts",
    "agent_questions",
    "connections",
    "shared_interview_questions",
    "question_upvotes",
    "application_outcomes",
    "privacy_audit_log",
    "user_achievements",
    "user_streaks",
)

SERVER_ONLY_TABLES = (
    "password_reset_tokens",
    "stripe_webhook_events",
)


def migration_text(root: Path) -> str:
    paths = [
        root / "supabase" / "migrations",
        root / "supabase-local" / "volumes" / "db" / "init",
        root / "backend" / "db" / "migrations",
    ]
    files = sorted(path for directory in paths if directory.exists() for path in directory.glob("*.sql"))
    return "\n".join(path.read_text(encoding="utf-8", errors="replace") for path in files)


def verify(root: Path) -> dict[str, object]:
    text = migration_text(root)
    checks: dict[str, dict[str, bool]] = {}
    for table in REQUIRED_TABLES:
        enablement = bool(re.search(rf"ALTER\s+TABLE\s+(?:public\.)?{re.escape(table)}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY", text, re.I))
        policy = bool(re.search(rf"CREATE\s+POLICY\s+[^\n]+\s+ON\s+(?:public\.)?{re.escape(table)}\b", text, re.I))
        with_check = bool(re.search(rf"CREATE\s+POLICY[\s\S]+?ON\s+(?:public\.)?{re.escape(table)}\b[\s\S]+?WITH\s+CHECK\s*\(", text, re.I))
        checks[table] = {
            "rls_enabled": enablement,
            "policy_present": policy,
            "mutation_with_check": with_check,
            "pass": enablement and policy and with_check,
        }

    server_only: dict[str, dict[str, bool]] = {}
    for table in SERVER_ONLY_TABLES:
        enablement = bool(re.search(rf"ALTER\s+TABLE\s+(?:public\.)?{re.escape(table)}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY", text, re.I))
        revoke = bool(re.search(rf"REVOKE\s+ALL\s+ON\s+(?:TABLE\s+)?(?:public\.)?{re.escape(table)}\s+FROM\s+anon\s*,\s*authenticated", text, re.I))
        service_grant = bool(re.search(rf"GRANT\s+(?:SELECT|ALL|SELECT,\s*INSERT)[^;]+ON\s+(?:TABLE\s+)?(?:public\.)?{re.escape(table)}\s+TO\s+service_role", text, re.I))
        server_only[table] = {
            "rls_enabled": enablement,
            "public_roles_revoked": revoke,
            "service_role_granted": service_grant,
            "pass": enablement and revoke and service_grant,
        }

    failed = [table for table, check in checks.items() if not check["pass"]]
    failed_server_only = [table for table, check in server_only.items() if not check["pass"]]
    return {
        "schema_version": 2,
        "required_tables": list(REQUIRED_TABLES),
        "server_only_tables": list(SERVER_ONLY_TABLES),
        "checks": checks,
        "server_only_checks": server_only,
        "failed_tables": failed,
        "failed_server_only_tables": failed_server_only,
        "status": "pass" if not failed and not failed_server_only else "fail",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = verify(args.root)
    serialized = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
