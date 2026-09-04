#!/usr/bin/env python3
"""Incremental SimilarWeb benchmark collector for OmniSaveAI.

The collector is deliberately conservative: it saves after every API call, keeps
unavailable metrics as explicit records, and produces a visual report even when
SimilarWeb credits or metric prerequisites prevent numeric results.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import matplotlib.pyplot as plt
import numpy as np

# NOTE: `data_api` (Sandbox runtime) is imported lazily inside collect() so
# --help and --render-only never require the sandbox runtime to be present.


DOMAINS: Sequence[str] = (
    "linkedmash.com",
    "linkedin.com",
    "medium.com",
    "substack.com",
    "readwise.io",
    "raindrop.io",
    "pocket.com",
    "instagram.com",
)

METRICS: Sequence[Tuple[str, str, Dict[str, str]]] = (
    ("global_rank", "SimilarWeb/get_global_rank", {}),
    (
        "visits_total",
        "SimilarWeb/get_visits_total",
        {"country": "world", "granularity": "monthly"},
    ),
    (
        "unique_visit",
        "SimilarWeb/get_unique_visit",
        {"country": "world", "granularity": "monthly"},
    ),
    (
        "bounce_rate",
        "SimilarWeb/get_bounce_rate",
        {"country": "world", "granularity": "monthly"},
    ),
    (
        "traffic_sources_desktop",
        "SimilarWeb/get_traffic_sources_desktop",
        {"country": "world", "granularity": "monthly"},
    ),
    (
        "traffic_sources_mobile",
        "SimilarWeb/get_traffic_sources_mobile",
        {"country": "world", "granularity": "monthly"},
    ),
    (
        "traffic_by_country",
        "SimilarWeb/get_total_traffic_by_country",
        {"limit": "10"},
    ),
)

STATUS_ORDER = ("success", "unavailable", "blocked", "error", "pending")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_write_json(path: Path, payload: Any) -> None:
    """Write JSON atomically so a killed process cannot corrupt the last receipt."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, default=str, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
        return value if isinstance(value, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def ensure_shape(existing: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    payload = existing or {}
    payload.setdefault("schema_version", 1)
    payload.setdefault("generated_at", utc_now())
    payload.setdefault("domains", list(DOMAINS))
    payload.setdefault("metrics", {})
    payload.setdefault("errors", [])
    payload.setdefault("runs", [])
    for domain in DOMAINS:
        domain_metrics = payload["metrics"].setdefault(domain, {})
        for metric_name, api_name, query in METRICS:
            domain_metrics.setdefault(
                metric_name,
                {
                    "status": "pending",
                    "api_name": api_name,
                    "query": query,
                    "attempt_count": 0,
                },
            )
    return payload


def record_text(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, default=str).lower()
    except (TypeError, ValueError):
        return str(value).lower()


def looks_unavailable(value: Any) -> bool:
    """True when the API says the metric itself is not available (as opposed to
    a credit/prerequisite problem, which is a different, fixable state)."""
    text = record_text(value)
    markers = (
        "unavailable",
        "not available",
        "no data available",
        "metric is not",
    )
    return any(marker in text for marker in markers)


def looks_prerequisite(value: Any) -> bool:
    """True when credits/quota/upgrade/precondition wording explains the lack of
    a number — the metric exists but the account cannot fetch it right now."""
    text = record_text(value)
    markers = (
        "insufficient credit",
        "insufficient credits",
        "credit depleted",
        "precondition",
        "upgrade",
        "quota",
        "no access",
        "forbidden",
    )
    return any(marker in text for marker in markers)


def response_is_error(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    error_keys = {"error", "errors", "exception", "traceback"}
    if any(key in value for key in error_keys):
        return True
    status = value.get("status")
    if isinstance(status, int) and status >= 400:
        return True
    if isinstance(status, str) and status.lower() in {"error", "failed", "failure"}:
        return True
    return False


def iter_numeric(value: Any, key_hint: str = "") -> Iterable[Tuple[str, float]]:
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        yield key_hint, float(value)
        return
    if isinstance(value, dict):
        for key, child in value.items():
            yield from iter_numeric(child, str(key))
        return
    if isinstance(value, list):
        for child in value:
            yield from iter_numeric(child, key_hint)


def primary_value(metric_name: str, value: Any) -> Optional[float]:
    """Extract a display-only scalar without changing or flattening raw API data."""
    candidates = list(iter_numeric(value))
    if not candidates:
        return None
    preferred_terms = {
        "visits_total": ("visits", "value", "total"),
        "unique_visit": ("unique", "visits", "value"),
        "bounce_rate": ("bounce", "value"),
        "global_rank": ("rank", "global"),
    }.get(metric_name, ())
    for term in preferred_terms:
        for key, number in candidates:
            if term in key.lower():
                return number
    return candidates[0][1]


def display_number(value: Optional[float]) -> str:
    if value is None:
        return "—"
    if abs(value) >= 1_000_000_000:
        return f"{value / 1_000_000_000:.1f}B"
    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if abs(value) >= 1_000:
        return f"{value / 1_000:.1f}K"
    return f"{value:,.2f}".rstrip("0").rstrip(".")


def status_counts(payload: Dict[str, Any]) -> Dict[str, int]:
    counts = {status: 0 for status in STATUS_ORDER}
    for domain in DOMAINS:
        for metric_name, _, _ in METRICS:
            status = payload["metrics"].get(domain, {}).get(metric_name, {}).get("status", "pending")
            counts[status] = counts.get(status, 0) + 1
    return counts


def save_run_history(history_path: Path, payload: Dict[str, Any], started_at: str) -> None:
    counts = status_counts(payload)
    summary = {
        "run_started_at": started_at,
        "run_finished_at": payload.get("updated_at"),
        "success_count": counts.get("success", 0),
        "unavailable_count": counts.get("unavailable", 0),
        "blocked_count": counts.get("blocked", 0),
        "error_count": counts.get("error", 0),
        "pending_count": counts.get("pending", 0),
    }
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with history_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(summary, ensure_ascii=False) + "\n")


def _new_api_client() -> Any:
    """Build the Sandbox API client on first use only, so --help and
    --render-only work on machines without the sandbox runtime."""
    import sys

    sandbox_runtime = "/opt/.manus/.sandbox-runtime"
    if sandbox_runtime not in sys.path:
        sys.path.append(sandbox_runtime)
    from data_api import ApiClient  # type: ignore  # noqa: E402

    return ApiClient()


def collect(output_path: Path, history_path: Path, force: bool = False) -> Dict[str, Any]:
    existing = load_json(output_path)
    payload = ensure_shape(existing)
    payload["updated_at"] = utc_now()
    started_at = payload["updated_at"]
    client = _new_api_client()

    def checkpoint() -> None:
        payload["updated_at"] = utc_now()
        atomic_write_json(output_path, payload)

    checkpoint()
    for domain in DOMAINS:
        for metric_name, api_name, query in METRICS:
            previous = payload["metrics"][domain].get(metric_name, {})
            if not force and previous.get("status") == "success":
                continue
            attempt_count = int(previous.get("attempt_count", 0)) + 1
            receipt: Dict[str, Any] = {
                "status": "pending",
                "api_name": api_name,
                "query": query,
                "attempt_count": attempt_count,
                "started_at": utc_now(),
            }
            payload["metrics"][domain][metric_name] = receipt
            checkpoint()
            try:
                response = client.call_api(
                    api_name,
                    path_params={"domain": domain},
                    query=query,
                )
                receipt["finished_at"] = utc_now()
                receipt["raw_response"] = response
                receipt["primary_value"] = primary_value(metric_name, response)
                if looks_unavailable(response):
                    receipt["status"] = "unavailable"
                    receipt["availability_note"] = "SimilarWeb returned an unavailable-metric response."
                elif looks_prerequisite(response):
                    receipt["status"] = "blocked"
                    receipt["availability_note"] = "SimilarWeb returned a credit/prerequisite response (account-level limitation)."
                elif response_is_error(response):
                    receipt["status"] = "error"
                    receipt["error"] = record_text(response)[:2_000]
                else:
                    receipt["status"] = "success"
            except Exception as exc:  # API client exceptions vary by runtime.
                receipt["finished_at"] = utc_now()
                if looks_prerequisite(exc):
                    receipt["status"] = "blocked"
                    receipt["availability_note"] = "SimilarWeb call was blocked by a credit/prerequisite limitation."
                elif looks_unavailable(exc):
                    receipt["status"] = "unavailable"
                    receipt["availability_note"] = "SimilarWeb returned an unavailable-metric response."
                else:
                    receipt["status"] = "error"
                receipt["error"] = str(exc)
                payload["errors"].append(
                    {
                        "domain": domain,
                        "metric": metric_name,
                        "status": receipt["status"],
                        "error": str(exc),
                        "at": receipt["finished_at"],
                    }
                )
            payload["metrics"][domain][metric_name] = receipt
            checkpoint()

    payload["runs"].append(
        {
            "started_at": started_at,
            "finished_at": payload["updated_at"],
            "counts": status_counts(payload),
        }
    )
    payload["runs"] = payload["runs"][-30:]
    checkpoint()
    save_run_history(history_path, payload, started_at)
    return payload


def build_chart(payload: Dict[str, Any], chart_path: Path) -> None:
    chart_path.parent.mkdir(parents=True, exist_ok=True)
    metric_names = [name for name, _, _ in METRICS]
    status_to_number = {"success": 1, "unavailable": 0, "blocked": -1, "error": -2, "pending": -3}
    status_colors = {"success": "#34d399", "unavailable": "#f59e0b", "blocked": "#a78bfa", "error": "#f87171", "pending": "#94a3b8"}
    matrix = np.array(
        [
            [status_to_number.get(payload["metrics"].get(domain, {}).get(metric, {}).get("status", "pending"), -3) for metric in metric_names]
            for domain in DOMAINS
        ]
    )

    figure, (heatmap_axis, values_axis) = plt.subplots(
        1,
        2,
        figsize=(17, 8),
        gridspec_kw={"width_ratios": [1.7, 1]},
    )
    figure.subplots_adjust(left=0.07, right=0.98, top=0.86, bottom=0.2, wspace=0.12)
    figure.patch.set_facecolor("#0f172a")
    for axis in (heatmap_axis, values_axis):
        axis.set_facecolor("#0f172a")
        axis.tick_params(colors="#cbd5e1", labelsize=9)
        for spine in axis.spines.values():
            spine.set_color("#334155")

    heatmap_axis.imshow(matrix, cmap=plt.matplotlib.colors.ListedColormap(["#94a3b8", "#f87171", "#a78bfa", "#f59e0b", "#34d399"]), vmin=-3, vmax=1, aspect="auto")
    heatmap_axis.set_xticks(range(len(metric_names)))
    heatmap_axis.set_xticklabels([metric.replace("_", "\n") for metric in metric_names], rotation=0, color="#cbd5e1", fontsize=8)
    heatmap_axis.set_yticks(range(len(DOMAINS)))
    heatmap_axis.set_yticklabels(DOMAINS, color="#cbd5e1", fontsize=9)
    heatmap_axis.set_title("Metric availability by domain", color="#f8fafc", fontsize=13, pad=14, loc="left")
    heatmap_axis.set_xlabel("", color="#94a3b8", fontsize=9, labelpad=12)
    for row_index, domain in enumerate(DOMAINS):
        for col_index, metric in enumerate(metric_names):
            status = payload["metrics"].get(domain, {}).get(metric, {}).get("status", "pending")
            heatmap_axis.text(col_index, row_index, status[0].upper(), ha="center", va="center", color="#0f172a", fontsize=8)

    visit_values = []
    visit_domains = []
    for domain in DOMAINS:
        record = payload["metrics"].get(domain, {}).get("visits_total", {})
        value = record.get("primary_value")
        if isinstance(value, (int, float)) and math.isfinite(float(value)):
            visit_domains.append(domain.replace(".com", "").replace(".io", ""))
            visit_values.append(float(value))
    if visit_values:
        values_axis.barh(visit_domains, visit_values, color="#38bdf8")
        values_axis.set_title("Latest returned visits scalar", color="#f8fafc", fontsize=13, pad=14, loc="left")
        values_axis.set_xlabel("Value from raw response", color="#94a3b8", fontsize=9)
        values_axis.grid(axis="x", color="#334155", alpha=0.5)
        values_axis.set_axisbelow(True)
    else:
        values_axis.text(0.5, 0.55, "No numeric visits value\nwas returned in this run", ha="center", va="center", color="#f8fafc", fontsize=13, linespacing=1.5)
        values_axis.text(0.5, 0.38, "The availability matrix is the authoritative result.\nUnavailable metrics are not estimated.", ha="center", va="center", color="#f59e0b", fontsize=9, linespacing=1.5)
        values_axis.set_xticks([])
        values_axis.set_yticks([])
        values_axis.set_title("Numeric comparison", color="#f8fafc", fontsize=13, pad=14, loc="left")

    figure.suptitle("OmniSaveAI · SimilarWeb benchmark receipt", color="#f8fafc", fontsize=17, x=0.03, ha="left")
    figure.text(0.03, 0.055, "Green = returned data · amber = unavailable · violet = credit/prerequisite blocked · red = error · gray = pending", color="#94a3b8", fontsize=8)
    figure.text(0.03, 0.025, f"Generated {payload.get('updated_at', 'unknown')} · Raw responses retained in the JSON receipt", color="#94a3b8", fontsize=8)
    figure.savefig(chart_path, dpi=160, facecolor=figure.get_facecolor())
    plt.close(figure)


def markdown_report(payload: Dict[str, Any], chart_path: Path, report_path: Path) -> None:
    counts = status_counts(payload)
    lines: List[str] = [
        "# OmniSaveAI SimilarWeb Benchmark",
        "",
        f"**Generated:** `{payload.get('updated_at', 'unknown')}`  ",
        "**Scope:** Eight domains × seven SimilarWeb metric families.  ",
        "**Interpretation rule:** unavailable or error responses are reported as-is; no traffic, ranking, engagement, source, or country value is inferred when the API does not return a usable metric.",
        "",
        f"![Metric availability chart]({chart_path.name})",
        "",
        "## Run summary",
        "",
        "| Status | Metric records | Meaning |",
        "|---|---:|---|",
        f"| Success | {counts.get('success', 0)} | SimilarWeb returned a response treated as usable. |",
        f"| Unavailable | {counts.get('unavailable', 0)} | SimilarWeb reported a missing metric or unavailable response. |",
        f"| Blocked | {counts.get('blocked', 0)} | SimilarWeb reported a credit/quota/upgrade/precondition limitation — the metric exists but the account cannot fetch it yet. |",
        f"| Error | {counts.get('error', 0)} | The call failed or returned an error-shaped response. |",
        f"| Pending | {counts.get('pending', 0)} | No call receipt exists yet. |",
        "",
        "## Domain × metric receipt",
        "",
        "| Domain | Global rank | Visits | Unique visit | Bounce rate | Desktop sources | Mobile sources | Traffic by country |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for domain in DOMAINS:
        cells = []
        for metric_name, _, _ in METRICS:
            record = payload["metrics"].get(domain, {}).get(metric_name, {})
            status = record.get("status", "pending")
            value = record.get("primary_value")
            if status == "success":
                cells.append(f"Success ({display_number(value)})")
            elif status == "unavailable":
                note = str(record.get("availability_note", "unavailable"))
                cells.append(f"Unavailable — {note}")
            elif status == "blocked":
                note = str(record.get("availability_note", "blocked by credit/prerequisite"))
                cells.append(f"Blocked — {note}")
            elif status == "error":
                cells.append(f"Error — {str(record.get('error', 'unknown'))[:80]}")
            else:
                cells.append("Pending")
        lines.append(f"| {domain} | " + " | ".join(cells) + " |")

    lines.extend(
        [
            "",
            "## LinkedMash-informed reading",
            "",
            "The benchmark is designed to compare the product ecosystem around LinkedIn saved-content workflows, not to make claims about product quality from traffic alone. LinkedMash’s strongest workflow signals remain its browser-session capture, full-history import, new-save synchronization, thread capture, rediscovery, and portable exports. OmniSaveAI should use those as workflow benchmarks while preserving its multi-platform, career-context, evidence, and read-only agent boundaries.",
            "",
            "## Caveats",
            "",
            "SimilarWeb data is constrained by the API’s historical window, monthly granularity, geography behavior, and account-level metric availability. The collector saves each receipt immediately after the corresponding call, so a later failure does not erase earlier results. Re-running the script retries non-success records and skips previously successful records unless `--force` is supplied.",
            "",
            "## References",
            "",
            "1. [SimilarWeb Analytics skill guidance](https://www.similarweb.com/)",
            "2. [LinkedMash product findings captured for OmniSaveAI](https://www.linkedmash.com/)",
        ]
    )
    atomic_write_json(report_path.with_suffix(".metadata.json"), {"generated_at": payload.get("updated_at"), "status_counts": counts})
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("benchmarks/omnisave_benchmark_full.json"), help="Incremental JSON receipt path")
    parser.add_argument("--history", type=Path, default=Path("benchmarks/omnisave_benchmark_history.jsonl"), help="Append-only run summary path")
    parser.add_argument("--chart", type=Path, default=Path("benchmarks/omnisave_benchmark_chart.png"), help="PNG visual output path")
    parser.add_argument("--report", type=Path, default=Path("benchmarks/omnisave_benchmark_report.md"), help="Markdown report path")
    parser.add_argument("--force", action="store_true", help="Re-fetch even records that previously succeeded")
    parser.add_argument("--render-only", action="store_true", help="Render chart and report from the existing JSON receipt without API calls")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.render_only:
        payload = load_json(args.output)
        if payload is None:
            raise SystemExit(f"No valid receipt found at {args.output}")
        payload = ensure_shape(payload)
    else:
        payload = collect(args.output, args.history, force=args.force)
    build_chart(payload, args.chart)
    markdown_report(payload, args.chart, args.report)
    counts = status_counts(payload)
    print(json.dumps({"output": str(args.output), "chart": str(args.chart), "report": str(args.report), "counts": counts}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
