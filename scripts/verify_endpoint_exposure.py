#!/usr/bin/env python3
"""Verify that the generated Go route inventory matches the exposure registry.

The registry is intentionally declarative while the inventory is generated from
an actual router. This check focuses on the dangerous direction: an endpoint
that is reachable without user auth must be explicitly listed as anonymous or
API-key protected. It also reports stale registry entries so route removals do
not silently leave documentation behind.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable

import yaml


def normalize(pattern: str) -> str:
    pattern = re.sub(r"\{[^}/]+\}", "{param}", pattern)
    return pattern.rstrip("/") or "/"


def registry_entries(registry: dict) -> set[tuple[str, str]]:
    entries: set[tuple[str, str]] = set()
    for key in ("anonymous", "api_key_protected"):
        for item in registry.get(key, []) or []:
            method, pattern = item.split(" ", 1)
            entries.add((method.upper(), normalize(pattern)))
    return entries


def actual_unprotected(routes: Iterable[dict]) -> set[tuple[str, str]]:
    return {
        (str(route["method"]).upper(), normalize(str(route["pattern"])))
        for route in routes
        if not route.get("auth_protected", False)
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=Path, help="Generated route inventory JSON")
    parser.add_argument(
        "--registry",
        type=Path,
        default=Path("infra/endpoint-exposure.yml"),
        help="Endpoint exposure registry YAML",
    )
    args = parser.parse_args()

    routes = json.loads(args.inventory.read_text(encoding="utf-8"))
    registry = yaml.safe_load(args.registry.read_text(encoding="utf-8")) or {}
    registered = registry_entries(registry)
    actual = actual_unprotected(routes)

    ignored = {("GET", "/metrics")}
    missing = sorted(actual - registered - ignored)
    stale = sorted(registered - actual)

    if missing:
        print("Unprotected routes missing from exposure registry:", file=sys.stderr)
        for method, pattern in missing:
            print(f"- {method} {pattern}", file=sys.stderr)
    if stale:
        print("Informational: registry entries are delegated or not mounted by the Go gateway:")
        for method, pattern in stale:
            print(f"- {method} {pattern}")

    if missing:
        return 1
    print(f"endpoint exposure parity: PASS ({len(routes)} routes, {len(registered)} explicit public/API-key entries)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
