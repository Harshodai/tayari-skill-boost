#!/usr/bin/env python3
"""Env-propagation contract check.

Fails if a Go/Python source file reads os.Getenv/os.getenv("X") but "X" is
never passed through the `environment:` block of ANY service in
docker-compose.yml or docker-compose.production.yml. Source: lessons.md
2026-09-10 — env vars set in .env but never passed through docker-compose,
found independently 3 times across different services.

This is a name-level check (not per-service): it does not know which
service is supposed to receive which var, it only proves the var is wired
through *some* compose file to *some* service. That's enough to catch the
actual historical bug class (var referenced by code, wired nowhere).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPOSE_FILES = [ROOT / "docker-compose.yml", ROOT / "docker-compose.production.yml"]
GO_DIRS = [ROOT / "backend/go"]
PY_DIRS = [ROOT / "backend/python"]
BASELINE_FILE = ROOT / "scripts/env_propagation_baseline.json"
UPDATE_BASELINE = "--update-baseline" in sys.argv

# Vars the container runtime / stdlib sets, or third-party libs read directly
# — never expected to appear in our own compose `environment:` blocks.
IGNORE = {
    "PATH", "HOME", "PWD", "HOSTNAME", "USER", "SHELL", "LANG", "TERM",
    "GOPATH", "GOCACHE", "GOFLAGS", "GOOS", "GOARCH", "CI", "TZ",
    "PYTHONPATH", "PYTHONUNBUFFERED", "PYTHONDONTWRITEBYTECODE",
    "HF_HOME", "TRANSFORMERS_CACHE", "NLTK_DATA", "XDG_CACHE_HOME",
}

GO_GETENV_RE = re.compile(r'os\.(?:Getenv|LookupEnv)\(\s*"([A-Z][A-Z0-9_]*)"\s*\)')
PY_GETENV_RE = re.compile(
    r'os\.(?:getenv|environ\.get)\(\s*["\']([A-Z][A-Z0-9_]*)["\']'
    r'|os\.environ\[\s*["\']([A-Z][A-Z0-9_]*)["\']\s*\]'
)
# pydantic Settings-style fields: FOO_BAR: str = Field(..., env="FOO_BAR") or just declared field name
PY_PYDANTIC_ENV_RE = re.compile(r'env\s*=\s*["\']([A-Z][A-Z0-9_]*)["\']')

# compose `environment:` entries: "  VAR: ${VAR:-x}" or "  - VAR=${VAR}" or "  - VAR"
COMPOSE_VAR_RE = re.compile(r'^\s*(?:-\s*)?([A-Z][A-Z0-9_]*)\s*[:=]', re.MULTILINE)
COMPOSE_VAR_BARE_RE = re.compile(r'^\s*-\s*([A-Z][A-Z0-9_]*)\s*$', re.MULTILINE)


def collect_compose_vars() -> set:
    found = set()
    for cf in COMPOSE_FILES:
        if not cf.exists():
            continue
        text = cf.read_text()
        # only scan within `environment:` blocks to avoid picking up unrelated YAML keys
        lines = text.splitlines()
        in_env_block = False
        block_indent = None
        for line in lines:
            stripped = line.strip()
            if stripped == "environment:":
                in_env_block = True
                block_indent = len(line) - len(line.lstrip())
                continue
            if in_env_block:
                if not stripped:
                    continue
                indent = len(line) - len(line.lstrip())
                if indent <= block_indent:
                    in_env_block = False
                    continue
                m = COMPOSE_VAR_RE.match(line) or COMPOSE_VAR_BARE_RE.match(line)
                if m:
                    found.add(m.group(1))
        # also catch ${VAR} interpolations anywhere (covers args:/build: passthroughs)
        for m in re.finditer(r'\$\{([A-Z][A-Z0-9_]*)', text):
            found.add(m.group(1))
    return found


def collect_go_reads() -> dict:
    reads = {}
    for d in GO_DIRS:
        for f in d.rglob("*.go"):
            if "_test.go" in f.name:
                continue
            text = f.read_text(errors="ignore")
            for m in GO_GETENV_RE.finditer(text):
                reads.setdefault(m.group(1), []).append(str(f.relative_to(ROOT)))
    return reads


def collect_py_reads() -> dict:
    reads = {}
    for d in PY_DIRS:
        for f in d.rglob("*.py"):
            rel = str(f)
            if "/tests/" in rel or f.name.startswith("test_") or "/.venv/" in rel or "/nltk_data/" in rel:
                continue
            text = f.read_text(errors="ignore")
            for m in PY_GETENV_RE.finditer(text):
                var = m.group(1) or m.group(2)
                reads.setdefault(var, []).append(str(f.relative_to(ROOT)))
            for m in PY_PYDANTIC_ENV_RE.finditer(text):
                reads.setdefault(m.group(1), []).append(str(f.relative_to(ROOT)))
    return reads


def main() -> int:
    compose_vars = collect_compose_vars()
    go_reads = collect_go_reads()
    py_reads = collect_py_reads()

    all_reads = {}
    for var, files in {**go_reads, **py_reads}.items():
        all_reads.setdefault(var, set()).update(files)
    for var, files in go_reads.items():
        all_reads.setdefault(var, set()).update(files)
    for var, files in py_reads.items():
        all_reads.setdefault(var, set()).update(files)

    missing = {
        var: files for var, files in all_reads.items()
        if var not in compose_vars and var not in IGNORE
    }

    if UPDATE_BASELINE:
        BASELINE_FILE.write_text(json.dumps(sorted(missing), indent=2) + "\n")
        print(f"Baseline updated: {len(missing)} known-unwired var(s) written to {BASELINE_FILE}")
        return 0

    baseline = set(json.loads(BASELINE_FILE.read_text())) if BASELINE_FILE.exists() else set()
    new_missing = {v: f for v, f in missing.items() if v not in baseline}
    fixed = baseline - set(missing)

    if fixed:
        print(f"{len(fixed)} previously-baselined var(s) are now wired (baseline is stale, "
              f"run --update-baseline): {', '.join(sorted(fixed))}\n")

    if new_missing:
        print("NEW vars read by application code but never passed through any "
              "`environment:` block in docker-compose.yml or docker-compose.production.yml:")
        for var in sorted(new_missing):
            files = ", ".join(sorted(new_missing[var])[:3])
            print(f"  - {var}  (read in: {files})")
        print(f"\n{len(new_missing)} new unwired var(s), not present in the committed baseline. "
              f"Wire the var through compose, or if intentionally container-scoped only, "
              f"add it to IGNORE in scripts/check_env_propagation.py.")
        return 1

    print(f"OK: no new unwired env vars ({len(missing)} pre-existing, baselined; "
          f"see scripts/env_propagation_baseline.json).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
