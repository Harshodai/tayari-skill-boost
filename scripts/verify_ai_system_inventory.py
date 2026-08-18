#!/usr/bin/env python3
"""Validate the minimum machine-readable AI governance inventory contract."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "docs" / "governance" / "ai-system-inventory.yml"
REQUIRED_SYSTEMS = {
    "tayari_resume_ats",
    "tayari_job_discovery",
    "tayari_interview_assistance",
    "tayari_external_research",
    "tayari_computer",
    "tayari_email_workspace",
    "tayari_google_workspace",
    "tayari_messaging_billing",
}
REQUIRED_FIELDS = {
    "owner:",
    "purpose:",
    "risk_tier:",
    "lifecycle_state:",
    "data_classes:",
    "outputs:",
    "human_control:",
    "excluded_use:",
    "evidence_requirements:",
    "review_owner:",
}


def main() -> int:
    content = INVENTORY.read_text(encoding="utf-8")
    errors: list[str] = []
    if "schema: tayari.ai-system-inventory.v1" not in content:
        errors.append("inventory schema missing")
    if "policy_references:" not in content:
        errors.append("policy references missing")
    for system in sorted(REQUIRED_SYSTEMS):
        marker = f"  - id: {system}\n"
        if marker not in content:
            errors.append(f"missing system {system}")
            continue
        start = content.index(marker)
        next_start = content.find("\n  - id:", start + len(marker))
        block = content[start:] if next_start == -1 else content[start:next_start]
        for field in REQUIRED_FIELDS:
            if f"    {field}" not in block:
                errors.append(f"{system}: missing {field}")
        if "excluded_use: []" in block:
            errors.append(f"{system}: excluded_use cannot be empty")
        if "evidence_requirements: []" in block:
            errors.append(f"{system}: evidence_requirements cannot be empty")
    if not re.search(r"review_cadence_days: [1-9][0-9]*", content):
        errors.append("review cadence missing or invalid")
    if errors:
        print(json.dumps({"status": "FAIL", "errors": errors}, sort_keys=True), file=sys.stderr)
        return 1
    print(json.dumps({"status": "PASS", "systems": sorted(REQUIRED_SYSTEMS), "schema": "tayari.ai-system-inventory.v1"}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
