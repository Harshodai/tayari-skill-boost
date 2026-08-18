#!/usr/bin/env python3
"""Fail-closed checks for known production truth boundaries.

This contract intentionally checks narrow, high-risk surfaces rather than banning
ordinary UI placeholders or test fixtures. It prevents demo behavior from being
reported as live production success.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def main() -> int:
    checks: list[dict[str, str]] = []

    def require(name: str, relative: str, needle: str) -> None:
        content = read(relative)
        if needle not in content:
            raise AssertionError(f"{name}: missing {needle!r} in {relative}")
        checks.append({"name": name, "status": "pass"})

    def forbid(name: str, relative: str, needle: str) -> None:
        content = read(relative)
        if needle in content:
            raise AssertionError(f"{name}: forbidden live-success text {needle!r} remains in {relative}")
        checks.append({"name": name, "status": "pass"})

    # The ATS simulator may exist as a development fixture, but the route must
    # require explicit demo enablement and must identify its evidence class.
    require("ats simulator explicit demo guard", "backend/python/app/main.py", "ENABLE_DEMO_FIXTURES")
    require("ats simulator fail-closed status", "backend/python/app/main.py", '"code": "disabled_by_launch_scope"')
    require("ats simulator evidence class", "backend/python/app/main.py", '"evidence_class": "demo_fixture"')

    # These messages falsely convert a failed or self-hosted checkout into a
    # successful credit purchase. They must never return in production UI.
    forbid("pricing automatic unlock claim", "src/pages/Pricing.tsx", "credit pack unlocked automatically")
    forbid("pricing simulated success claim", "src/pages/Pricing.tsx", "credits simulated successfully")

    # Newsletter submission must not silently sleep and clear the user's email.
    forbid("blog fake newsletter submission", "src/pages/Blog.tsx", "Simulate API call - in production, connect to email service")

    # Disabled release flags must control manually entered routes as well as
    # navigation visibility.
    require("interview-prep route flag gate", "src/App.tsx", "features.interviewPrep ?")
    require("interview-prep disabled redirect", "src/App.tsx", 'path="/interview/prep" element={<Navigate to="/resume" replace />}')
    require("computer route flag gate", "src/App.tsx", "features.computerControl ?")
    require("desktop route flag gate", "src/App.tsx", "features.desktopAgent ?")
    require("computer production flag", "src/config/features.ts", "computerControl: [false, true]")
    require("desktop production flag", "src/config/features.ts", "desktopAgent: [false, true]")
    require("isolated computer launch state", "docs/launch/2026-workspace-scope.yml", "workspace.isolated_computer:")
    require("local bridge launch state", "docs/launch/2026-workspace-scope.yml", "workspace.local_browser_bridge:")
    require("sensitive computer action disabled", "docs/launch/2026-workspace-scope.yml", "workspace.local_browser_sensitive_actions:")
    require("computer submission permanently disabled", "docs/launch/2026-workspace-scope.yml", "workspace.computer_submission:")

    # A legacy route may exist for explicit development fixtures, but every
    # handler must be protected by the same fail-closed gate. Other production
    # HTTP surfaces must not import these simulated modules.
    require("legacy job-seeker fixture gate", "backend/python/app/routes/agent.py", "_require_legacy_job_seeker_fixture")
    for relative in ["backend/python/app/main.py", "backend/python/app/api", "backend/python/app/routes"]:
        path = ROOT / relative
        files = [path] if path.is_file() else sorted(path.rglob("*.py"))
        for source in files:
            if source.name == "agent.py" and source.parent.name == "routes":
                continue
            content = source.read_text(encoding="utf-8")
            if source.name == "career_intelligence.py" and "app.services.career_intelligence" in content:
                if "ENABLE_DEMO_FIXTURES" not in content or "runtime_mode" not in content:
                    raise AssertionError(f"career-intelligence fixture import is not explicitly demo-labelled: {source}")
                continue
            for forbidden in (
                "app.agent.job_seeker_agent",
                "app.agent.email_connector",
                "app.services.career_intelligence",
            ):
                if forbidden in content:
                    raise AssertionError(f"legacy simulated module imported by production surface: {source}")
    checks.append({"name": "legacy simulated modules gated or absent from production HTTP surfaces", "status": "pass"})

    print(json.dumps({"status": "PASS", "checks": checks}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1)
