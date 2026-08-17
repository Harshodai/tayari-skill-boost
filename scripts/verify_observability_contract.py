#!/usr/bin/env python3
"""Verify versioned observability alerts map to emitted telemetry."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

REQUIRED_ALERTS = {
    "TayariQueueAgeHigh": "queue_age_seconds",
    "TayariProviderErrors": "llm_errors_total",
    "TayariBudgetRejections": "budget_exceeded_total",
    "TayariTaskFailures": "task_failures_total",
}


def verify(root: Path) -> dict[str, object]:
    alert_path = root / "infra" / "observability" / "alerts.yml"
    alert_doc = yaml.safe_load(alert_path.read_text(encoding="utf-8"))
    alerts = {item.get("name"): item for item in alert_doc.get("alerts", [])}
    telemetry_paths = [
        root / "backend" / "python" / "app" / "telemetry" / "counters.py",
        root / "backend" / "python" / "app" / "celery_app.py",
        root / "backend" / "python" / "app" / "middleware" / "operation_budget.py",
        root / "backend" / "go" / "internal" / "observability" / "metrics.go",
    ]
    telemetry_text = "\n".join(path.read_text(encoding="utf-8", errors="replace") for path in telemetry_paths)
    failures: list[str] = []
    if alert_doc.get("endpoint") != "/metrics":
        failures.append("alerts endpoint must be /metrics")
    if alert_doc.get("header") != "X-Internal-Token":
        failures.append("metrics endpoint must use X-Internal-Token")
    if alert_doc.get("format") != "json":
        failures.append("metrics format must remain json")
    for name, metric in REQUIRED_ALERTS.items():
        item = alerts.get(name)
        if not item:
            failures.append(f"missing alert {name}")
            continue
        if metric not in str(item.get("metric", "")):
            failures.append(f"alert {name} does not reference {metric}")
        for key in ("condition", "for", "severity", "owner"):
            if not str(item.get(key, "")).strip():
                failures.append(f"alert {name} missing {key}")
        if metric not in telemetry_text:
            failures.append(f"metric {metric} is not emitted by service telemetry")
    return {
        "schema_version": 1,
        "status": "pass" if not failures else "fail",
        "failures": failures,
        "required_alerts": REQUIRED_ALERTS,
        "observed_alerts": sorted(alerts),
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
