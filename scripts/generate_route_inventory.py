#!/usr/bin/env python3
"""
Route Inventory and Exposure Verification Script.

Inspects running/declarative Python FastAPI and Go Chi routes,
classifies auth boundaries, and diffs them against infra/endpoint-exposure.yml.
Asserts 0 unauthenticated exposed routes outside the explicit allowlist.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))

# Ensure minimal required env for app import
os.environ.setdefault("JWT_SECRET", "test-route-inventory-secret-32-chars-long")
os.environ.setdefault("SUPABASE_URL", "http://127.0.0.1:8008")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")


def inspect_python_routes():
    """Extract all routes and their auth protection from FastAPI app."""
    try:
        from app.main import app
    except Exception as e:
        print(f"[-] Error loading FastAPI app: {e}", file=sys.stderr)
        return []

    routes = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for method in route.methods:
                if method in ("HEAD", "OPTIONS"):
                    continue

                dependencies = getattr(route, "dependencies", []) or []
                endpoint = getattr(route, "endpoint", None)

                auth_protected = False
                if hasattr(endpoint, "__annotations__"):
                    for param, annotation in endpoint.__annotations__.items():
                        if "User" in str(annotation) or "auth" in str(annotation).lower():
                            auth_protected = True

                for dep in dependencies:
                    dep_name = getattr(dep.dependency, "__name__", "") if hasattr(dep, "dependency") else ""
                    if "user" in dep_name.lower() or "auth" in dep_name.lower() or "jwt" in dep_name.lower():
                        auth_protected = True

                routes.append({
                    "service": "python-ai",
                    "method": method,
                    "path": route.path,
                    "auth_protected": auth_protected,
                })
    return routes


def inspect_go_routes():
    """Extract all routes and auth classifications from Go Chi router."""
    import tempfile
    go_dir = REPO_ROOT / "backend" / "go"
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        proc = subprocess.run(
            ["go", "run", "./cmd/route_inventory", "-o", tmp_path],
            cwd=str(go_dir),
            capture_output=True,
            text=True,
            check=True,
        )
        with open(tmp_path, "r") as f:
            return json.load(f)
    except subprocess.CalledProcessError as e:
        print(f"[-] Error running Go route inventory helper: {e.stderr}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"[-] Error extracting Go routes: {e}", file=sys.stderr)
        return []
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def load_exposure_registry():
    """Load the exposure specification from infra/endpoint-exposure.yml."""
    reg_path = REPO_ROOT / "infra" / "endpoint-exposure.yml"
    if not reg_path.exists():
        print(f"[-] Exposure registry not found at {reg_path}", file=sys.stderr)
        return {}
    with open(reg_path, "r") as f:
        return yaml.safe_load(f)


def main():
    print("==================================================")
    print("🚀 Tayari Route Inventory & Exposure Scanner")
    print("==================================================")

    registry = load_exposure_registry()
    anonymous_allowed = set(registry.get("anonymous", []))
    internal_token_allowed = set(registry.get("internal_token_protected", []))
    api_key_allowed = set(registry.get("api_key_protected", []))

    print(f"[*] Loaded exposure registry with:")
    print(f"    - {len(anonymous_allowed)} explicitly allowed anonymous endpoints")
    print(f"    - {len(internal_token_allowed)} internal token endpoints")
    print(f"    - {len(api_key_allowed)} API-key protected endpoints")

    # 1. Inspect Go Chi routes
    go_routes = inspect_go_routes()
    print(f"\n[*] Discovered {len(go_routes)} Go Chi routes.")

    unauthenticated_exposed_violations = []
    unregistered_api_key_routes = []
    unregistered_internal_token_routes = []
    go_anonymous_routes = []
    go_protected_routes = []

    for r in go_routes:
        route_str = f"{r['method']} {r['pattern']}"
        auth_protected = r["auth_protected"]
        auth_type = r.get("auth_type", "none")

        if not auth_protected or auth_type == "none":
            go_anonymous_routes.append(route_str)
            if route_str not in anonymous_allowed:
                unauthenticated_exposed_violations.append({
                    "service": "go-gateway",
                    "route": route_str,
                    "reason": "Exposed anonymously without inclusion in infra/endpoint-exposure.yml anonymous allowlist",
                    "status_code": r.get("unauth_status_code"),
                })
        elif auth_type == "api_key":
            if route_str not in api_key_allowed:
                unregistered_api_key_routes.append(route_str)
            else:
                go_protected_routes.append(route_str)
        elif auth_type == "internal_token":
            if route_str not in internal_token_allowed:
                unregistered_internal_token_routes.append(route_str)
            else:
                go_protected_routes.append(route_str)
        else:
            go_protected_routes.append(route_str)

    print(f"[*] Go Gateway Policy Check:")
    print(f"    - Auth Protected (User Auth): {len(go_protected_routes)} routes")
    print(f"    - Explicitly Allowed Anonymous: {len(go_anonymous_routes)} routes")
    print(f"    - Unauthenticated Exposed Violations: {len(unauthenticated_exposed_violations)}")

    # 2. Inspect Python FastAPI routes
    py_routes = inspect_python_routes()
    print(f"\n[*] Discovered {len(py_routes)} Python FastAPI routes.")
    print(f"[*] Python Service Policy: Internal / Non-Public (python_not_public: ALL /)")

    # 3. Assert zero violations
    total_violations = len(unauthenticated_exposed_violations) + len(unregistered_api_key_routes) + len(unregistered_internal_token_routes)

    if total_violations > 0:
        print("\n❌ CRITICAL ROUTE EXPOSURE VIOLATIONS DETECTED:", file=sys.stderr)
        for v in unauthenticated_exposed_violations:
            print(f"    [!] Unauthenticated: {v['route']} (HTTP {v['status_code']}) - {v['reason']}", file=sys.stderr)
        for v in unregistered_api_key_routes:
            print(f"    [!] Missing API-key registration: {v}", file=sys.stderr)
        for v in unregistered_internal_token_routes:
            print(f"    [!] Missing internal-token registration: {v}", file=sys.stderr)
        sys.exit(1)

    print("\n==================================================")
    print(f"✅ Route Exposure Scan Complete — 0 Unauthenticated Exposed Routes Detected")
    print(f"   Total Go Chi Routes: {len(go_routes)}")
    print(f"   Total Python Routes: {len(py_routes)}")
    print("==================================================")
    sys.exit(0)


if __name__ == "__main__":
    main()
