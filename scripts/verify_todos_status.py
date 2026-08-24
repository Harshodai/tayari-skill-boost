#!/usr/bin/env python3
"""Verify the current repository status of every unchecked remediation TODO.

This checker is deliberately conservative: an existing file or green static
command may mark an item PARTIAL, but never COMPLETE when the TODO requires
live infrastructure, human approval, or measured business evidence. It emits a
human-readable table by default and JSON with ``--json``. It never reads secret
values or contacts external services.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
TODO = ROOT / "TAYARI_REMEDIATION_TODOS.md"


@dataclass(frozen=True)
class TodoItem:
    line: int
    section: str
    item_id: str
    priority: str
    title: str
    detail: str
    status: str
    evidence: tuple[str, ...]
    blocking: str
    rationale: str


PARTIAL_EVIDENCE: dict[str, tuple[tuple[str, ...], str, str, str]] = {
    "M6-03": (("scripts/run_staging_hostile_suite.py", "scripts/staging_integration_gate.sh"), "BLOCKED_LIVE", "direct", "Plan and local contracts exist; live hostile staging still requires an approved deployed target."),
    "M6-04": (("scripts/production_promotion_gate.sh", "scripts/mac_artifact_contract.sh"), "PARTIAL", "direct", "Static artifact contracts exist; immutable promotion and credentialed Apple evidence remain open."),
    "M7-03": (("backend/python/app/services/ats_engine.py", "backend/python/tests/test_ats_transparency.py"), "PARTIAL", "scope", "Backend scoring evidence and adversarial tests exist; full product UI/evaluation closure remains open."),
    "M7-08": (("docs/production/FINAL_PRODUCTION_READINESS.md", "src/pages/Privacy.tsx"), "PARTIAL", "scope", "Truthfulness/privacy documentation exists; full visible moat and live provider evidence remain open."),
    "M8-01": (("backend/python/app/telemetry/product_events.py", "backend/python/tests/test_product_events.py"), "PARTIAL", "business", "A safe event contract exists; full visitor-to-paid emission and payment cohort evidence remain open."),
    "M8-05": (("backend/python/app/middleware/operation_budget.py", "backend/python/app/services/automation_engine.py"), "PARTIAL", "business", "Distributed operation budgets exist; full cost attribution and all restart/provider/browser ceilings remain open."),
    "M9-03": (("backend/python/app/services/application_lifecycle.py", "backend/python/tests/test_application_lifecycle.py"), "PARTIAL", "direct", "Pure lifecycle and AutoPilot integration are tested; durable DB reconciliation and live duplicate-action proof remain open."),
    "M9-05": (("backend/python/app/services/job_identity.py", "backend/python/tests/test_job_identity.py"), "PARTIAL", "scope", "Deterministic identity exists; durable freshness/expiry ledger and provider fixtures remain open."),
    "M9-06": (("backend/python/app/services/ats_engine.py", "backend/python/app/telemetry/product_events.py"), "PARTIAL", "scope", "ATS evidence and safe product events exist; durable per-artifact model/prompt/cost traces remain open."),
    "M9-12": (("src/contexts/AuthContext.tsx", "src/api/resumes.ts", "src/pages/ResumeResults.tsx"), "PARTIAL", "scope", "High-risk frontend any/hook warnings were reduced; remaining lint warnings require bounded cleanup."),
    "M9-13": (("src/config/features.ts", "src/config/features.test.ts"), "PARTIAL", "scope", "Feature flags and release-scope tests exist; continued deferral is required until evidence gates close."),
}

DIRECT_LIVE_BLOCKERS = {"M4-08", "M6-02", "M6-03", "M6-04", "M9-01", "M9-02", "M9-03"}
BUSINESS_OR_SCOPE_GATES = {"M7-03", "M7-06", "M7-08", "M8-01", "M8-02", "M8-03", "M8-04"}


def _run(*args: str) -> str:
    try:
        return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, check=False).stdout.strip()
    except OSError:
        return ""


def parse_todos() -> list[tuple[int, str, str, str, str, str]]:
    section = ""
    rows: list[tuple[int, str, str, str, str, str]] = []
    em_dash_pattern = re.compile(r"^- \[ \] \*\*(M\d+(?:-\d+)?)(?: / (P\d))? — ([^*]+)\*\*\s*(.*)$")
    closed_heading_pattern = re.compile(r"^- \[ \] \*\*(M\d+(?:-\d+)?)(?: / (P\d|S\d))?\*\*\s*(.*)$")
    for line_no, line in enumerate(TODO.read_text(encoding="utf-8").splitlines(), 1):
        if line.startswith("## "):
            section = line[3:].strip()
        match = em_dash_pattern.match(line)
        if match:
            item_id, priority, title, detail = match.groups()
            rows.append((line_no, section, item_id, priority or "unclassified", title.strip(), detail.strip()))
            continue
        match = closed_heading_pattern.match(line)
        if match:
            item_id, priority, remainder = match.groups()
            title = remainder.split(".", 1)[0].strip() or remainder.strip()
            rows.append((line_no, section, item_id, priority or "unclassified", title, remainder.strip()))
    return rows


def _status_for(item_id: str) -> tuple[str, tuple[str, ...], str, str, str]:
    evidence = PARTIAL_EVIDENCE.get(item_id)
    if evidence:
        paths, status, blocking, rationale = evidence
        existing = tuple(path for path in paths if (ROOT / path).exists())
        return status, existing, blocking, rationale, ""
    if item_id in DIRECT_LIVE_BLOCKERS:
        return "PENDING", (), "direct", "No complete repository-only proof can close this item; live or durable release evidence is required.", ""
    if item_id in BUSINESS_OR_SCOPE_GATES:
        return "PENDING", (), "business", "Requires measured cohort, product, or live acceptance evidence not present in the repository.", ""
    return "PENDING", (), "scope", "Unchecked in the canonical backlog; no conservative closure evidence was registered by this verifier.", ""


def build_report() -> dict:
    rows = []
    for line, section, item_id, priority, title, detail in parse_todos():
        status, evidence, blocking, rationale, _ = _status_for(item_id)
        rows.append(TodoItem(line, section, item_id, priority, title, detail, status, evidence, blocking, rationale))
    tracked = {item.item_id for item in rows}
    expected = 38
    return {
        "schema": "tayari.todo-status.v1",
        "repository": str(ROOT),
        "head": _run("git", "rev-parse", "HEAD"),
        "branch": _run("git", "branch", "--show-current"),
        "worktree_clean": not bool(_run("git", "status", "--porcelain")),
        "todo_file": str(TODO.relative_to(ROOT)),
        "expected_pending_items": expected,
        "parsed_pending_items": len(rows),
        "parse_complete": len(rows) == expected and len(tracked) == expected,
        "summary": {
            "pending": sum(row.status == "PENDING" for row in rows),
            "partial": sum(row.status == "PARTIAL" for row in rows),
            "blocked_live": sum(row.status == "BLOCKED_LIVE" for row in rows),
            "complete": sum(row.status == "COMPLETE" for row in rows),
        },
        "items": [asdict(row) for row in rows],
        "policy": {
            "complete_requires_explicit_evidence": True,
            "live_or_business_evidence_is_not_inferred": True,
            "secrets_read": False,
            "external_services_contacted": False,
        },
    }


def print_text(report: dict) -> None:
    print(f"JobTayari TODO status: {report['parsed_pending_items']} pending entries parsed")
    print(f"HEAD: {report['head'] or 'unknown'}")
    print(f"worktree_clean: {report['worktree_clean']}")
    print("status summary: " + ", ".join(f"{key}={value}" for key, value in report["summary"].items()))
    print("-" * 120)
    print(f"{'Line':>4}  {'Item':<8} {'Pri':<12} {'Status':<12} {'Block':<8} Title")
    print("-" * 120)
    for item in report["items"]:
        print(f"{item['line']:>4}  {item['item_id']:<8} {item['priority']:<12} {item['status']:<12} {item['blocking']:<8} {item['title']}")
    print("-" * 120)
    print("Conservative policy: PARTIAL/PENDING/BLOCKED_LIVE never count as GO evidence.")


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    parser.add_argument("--output", type=Path, help="write JSON report to this path")
    parser.add_argument("--fail-on-open", action="store_true", help="exit 1 when any item is not COMPLETE")
    args = parser.parse_args(list(argv) if argv is not None else None)
    report = build_report()
    encoded = json.dumps(report, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(encoded + "\n", encoding="utf-8")
    if args.json:
        print(encoded)
    else:
        print_text(report)
    if not report["parse_complete"]:
        return 2
    if args.fail_on_open and report["summary"]["complete"] != report["parsed_pending_items"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
