#!/usr/bin/env python3
"""Static contract for high-risk route authorization and capability boundaries."""
from __future__ import annotations

import json
from pathlib import Path


def check(root: Path) -> dict[str, object]:
    go = root / "backend" / "go" / "internal" / "api"
    auth_go = root / "backend" / "go" / "internal" / "auth"
    py = root / "backend" / "python" / "app"
    checks = {
        "browser_go_capability_guard": "withCapability(capabilities.AutonomousBrowser" in (go / "routes_browser.go").read_text(),
        "browser_go_disabled_api_tests": "TestBrowserRoutesAreLockedWhenCapabilityDisabled" in (go / "capability_gate_test.go").read_text(),
        "browser_python_capability_guard": (
            (py / "api" / "browser_agent_routes.py").read_text().count("Capability.AUTONOMOUS_BROWSER") >= 4
            if (py / "api" / "browser_agent_routes.py").exists()
            else (py / "main.py").read_text().count("Capability.AUTONOMOUS_BROWSER") >= 4
        ),
        "browser_python_disabled_api_tests": "test_browser_routes_are_disabled_by_launch_scope" in (py / "tests" / "test_capability_gates.py").read_text(),
        "submission_python_capability_guard": "Capability.AUTONOMOUS_ATS_SUBMIT" in (py / "services" / "submission_guard.py").read_text(),
        "billing_go_auth_boundary": "internalOrAuthMiddleware" in (go / "routes_billing.go").read_text(),
        "service_token_bearer_separation_tests": "TestServiceTokenCannotBePresentedAsUserBearer" in (go / "auth_boundary_test.go").read_text(),
        "gmail_go_auth_boundary": "authMiddleware" in (go / "routes_gmail.go").read_text(),
        "gmail_python_capability_guard": "Capability.AUTONOMOUS_GMAIL" in (py / "api" / "gmail_routes.py").read_text(),
        "gmail_python_disabled_api_test": "test_gmail_parser_is_disabled_by_launch_scope" in (py / "tests" / "test_capability_gates.py").read_text(),
        "internal_python_token_boundary": "X-Internal-Token" in (py / "auth" / "dependencies.py").read_text(),
        "typed_identity_middleware": "WithIdentityContext" in (go / "auth_handlers.go").read_text(),
        "typed_tenant_authorization": "AuthorizationContextFromContext" in (go / "routes_tenant.go").read_text(),
        "tenant_authorization_negative_tests": "TestCheckAdvisorRoleRejectsCrossTenantContextReplay" in (go / "routes_tenant_authz_test.go").read_text(),
        "unknown_capability_fail_closed": "return false" in (root / "backend" / "go" / "internal" / "capabilities" / "capabilities.go").read_text(),
        "launch_scope_manifest": (root / "docs" / "launch" / "2026-workspace-scope.yml").exists(),
    }
    failures = [name for name, passed in checks.items() if not passed]
    return {"schema_version": 2, "checks": checks, "failures": failures, "status": "pass" if not failures else "fail"}


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    report = check(root)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
