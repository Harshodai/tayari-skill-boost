"""Static route-collision guard for the FastAPI app.

FastAPI/Starlette matches routes in registration order and uses the FIRST
match — the opposite of chi's last-wins behavior on the Go side, but the same
underlying bug class: registering the same (method, path) twice silently
makes one implementation permanently unreachable, with no error anywhere.

This test found five real duplicates on first run:
  - POST /api/v1/strategic/{analyze,entities,inject,ai-proof} duplicated in
    ai_routes.py and a now-deleted strategic_routes.py (the latter fully dead).
  - POST /api/v1/export/json duplicated in ai_routes.py and export_routes.py
    (harmless — identical behavior; the export_routes.py copy was removed).
  - POST /api/v1/communication/generate, /interview/prep, /offer/calculate,
    /interview/copilot all duplicated in ai_routes.py and
    interview_coach_routes.py. /interview/prep's dead copy in
    interview_coach_routes.py had a real feature the live one lacked: a
    job_description field, silently dropped by the live schema (Pydantic
    ignores unknown fields by default) even though the frontend sends it —
    fixed by adding the field to the live schema instead of reviving the
    dead copy. The other three were behaviorally identical duplicates.

Mirrors backend/go/internal/api/route_uniqueness_test.go's rationale and
approach — see that file's docstring for the original motivating bug
(a live access-control bypass caused by an ungated duplicate route).
"""
from __future__ import annotations

import re
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"
API_DIRS = [APP_ROOT / "api", APP_ROOT / "routes"]
# main.py registers ~65 routes directly via @app.get/post/... — a collision
# between one of those and a router file's @router.X for the same path is
# the identical bug class, so it's scanned alongside app/api and app/routes.
EXTRA_FILES = [APP_ROOT / "main.py"]

ROUTE_CALL = re.compile(r'@(?:router|app)\.(get|post|put|delete|patch)\(\s*"([^"]+)"')
PARAM_NAME = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")


def _iter_source_files():
    for api_dir in API_DIRS:
        if api_dir.is_dir():
            for path in sorted(api_dir.glob("*.py")):
                if not path.name.startswith("test_"):
                    yield path
    for path in EXTRA_FILES:
        if path.is_file():
            yield path


def _collect_registrations() -> dict[tuple[str, str], list[str]]:
    """method+normalized-path -> list of 'file:line' occurrences."""
    seen: dict[tuple[str, str], list[str]] = {}
    for path in _iter_source_files():
        lines = path.read_text().splitlines()
        for i, line in enumerate(lines, start=1):
            if line.strip().startswith("#"):
                continue
            m = ROUTE_CALL.search(line)
            if not m:
                continue
            method, raw_path = m.group(1), m.group(2)
            normalized = PARAM_NAME.sub("{}", raw_path)
            key = (method, normalized)
            seen.setdefault(key, []).append(f"{path.name}:{i}")
    return seen


def test_no_duplicate_route_registrations():
    seen = _collect_registrations()
    failures = [
        f"{method.upper()} {pattern} registered {len(locs)} times: {', '.join(sorted(locs))}"
        for (method, pattern), locs in sorted(seen.items())
        if len(locs) > 1
    ]
    assert not failures, (
        "duplicate route registration(s) found — FastAPI silently matches the FIRST "
        "registration and ignores every later one for that (method, path):\n  "
        + "\n  ".join(failures)
    )
