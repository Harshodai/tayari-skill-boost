"""
Milestone 3: Hierarchical Filesystem Logging Middleware.

Implements Meta-Harness (arXiv:2603.28052 §3 — End-to-End Optimization):
- Every graph traversal is logged as a machine-readable JSON file.
- Log path: tayari_logs/{user_id}/run_{run_id}.json
- DGM lineage: tayari_logs/{user_id}/lineage_{run_id}.json
- Aggregated stats: tayari_logs/{user_id}/meta_stats.json

The outer-loop optimizer reads raw failure traces from these files to:
  1. Identify which DSPy signatures produce the most validation failures.
  2. Bootstrap demonstration examples from successful traces.
  3. Evolve prompt/pipeline performance without scalar scores.

Atomic write contract:
  All writes go to {path}.tmp, then fsync, then os.rename().
  Partial/corrupt traces NEVER appear on the filesystem.

qm multi-tenant (yc-software/qm):
  All paths are scoped under {TAYARI_LOGS_DIR}/{user_id}/
  User A can never read or write User B's logs.
"""
from __future__ import annotations

import fcntl
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.unhobbling.state import JobTayariHarnessState
from app.unhobbling.multi_tenant import TenantWorkspace


# Schema version for forward-compatible log evolution
LOG_SCHEMA_VERSION = "1.0.0"


def _atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    """
    Atomically write JSON to `path` via tmp-fsync-rename pattern.
    Guarantees no partial/corrupt traces appear on the filesystem.
    Uses a writer-unique temporary filename to prevent concurrent writers
    from clobbering each other's temp files.
    """
    import threading
    tmp_path = path.with_suffix(f".tmp.{threading.current_thread().ident}.{os.getpid()}")
    serialized = json.dumps(data, indent=2, default=str)
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(serialized)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, path)  # atomic on POSIX


def _safe_state_snapshot(state: JobTayariHarnessState) -> Dict[str, Any]:
    """
    Build a serializable snapshot of state for logging.

    CRITICAL: context_variables are stored as their SHA-256 hashes only,
    NOT the raw text. Raw text is PII and must not appear in log files.
    The variable_handles metadata (token counts, section headings) IS logged.
    """
    # Redact raw text bodies — log only the handles (metadata)
    redacted_vars = {
        k: f"[REDACTED: {len(v)} chars, sha256={__import__('hashlib').sha256(v.encode()).hexdigest()[:16]}...]"
        for k, v in state.get("context_variables", {}).items()
    }
    snapshot = dict(state)
    snapshot["context_variables"] = redacted_vars
    if "stdout_history" in snapshot:
        snapshot["stdout_history"] = [
            "[REDACTED_STDOUT]" if len(entry) > 200 else entry
            for entry in snapshot["stdout_history"]
        ]
    # Ensure all types are JSON-serializable
    return snapshot


class HierarchicalLoggingMiddleware:
    """
    Meta-Harness hierarchical filesystem logger (arXiv:2603.28052).

    Usage:
        logger = HierarchicalLoggingMiddleware(state)
        # ... graph traversal ...
        logger.flush(final_state)

    Or as a context manager:
        with HierarchicalLoggingMiddleware(initial_state) as logger:
            # run graph
            logger.record_step(node_name, step_state)
        # flush is called automatically on exit
    """

    def __init__(self, initial_state: JobTayariHarnessState) -> None:
        self._user_id = initial_state["user_id"]
        self._run_id = initial_state["run_id"]
        self._workspace = TenantWorkspace(self._user_id)
        self._steps: List[Dict[str, Any]] = []
        self._start_time = time.time()
        self._initial_snapshot = _safe_state_snapshot(initial_state)

    def __enter__(self) -> "HierarchicalLoggingMiddleware":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        # Flush even on exception — we want failure traces
        try:
            self.flush(exception=str(exc_val) if exc_val else None)
        except Exception:  # noqa: BLE001
            pass  # Never let logging failure crash the main flow

    def record_step(
        self,
        node_name: str,
        state: JobTayariHarnessState,
        extras: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Record a single graph node execution step.
        Captures: node name, timestamp, route, validation_passed, error_trace,
        execution_result, current_iteration, stdout_history.
        """
        step: Dict[str, Any] = {
            "step_index": len(self._steps),
            "node_name": node_name,
            "timestamp_utc": time.time(),
            "route": state.get("route"),
            "validation_passed": state.get("validation_passed"),
            "current_iteration": state.get("current_iteration"),
            "syntax_errors_encountered": state.get("syntax_errors_encountered"),
            "dspy_signature_class": state.get("dspy_signature_class"),
            "execution_result": state.get("execution_result"),
            "error_trace": state.get("error_trace"),
            "stdout_snapshot": list(state.get("stdout_history", [])),
            "variable_handles": state.get("variable_handles", {}),
        }
        if extras:
            step["extras"] = extras
        self._steps.append(step)

    def flush(
        self,
        final_state: Optional[JobTayariHarnessState] = None,
        exception: Optional[str] = None,
    ) -> Path:
        """
        Write the complete run trace and DGM lineage to filesystem.
        Returns the path of the written run trace file.
        """
        end_time = time.time()
        duration_s = end_time - self._start_time

        # ── Run trace (arXiv:2603.28052 §3 fields) ───────────────────────────
        run_trace: Dict[str, Any] = {
            "schema_version": LOG_SCHEMA_VERSION,
            "user_id": self._user_id,
            "run_id": self._run_id,
            "timestamp_utc_start": self._start_time,
            "timestamp_utc_end": end_time,
            "duration_seconds": round(duration_s, 3),
            "exception": exception,
            "initial_state": self._initial_snapshot,
            "steps": self._steps,
            "final_state": _safe_state_snapshot(final_state) if final_state else None,
            "outcome": (
                "success" if (final_state and final_state.get("validation_passed"))
                else "terminal_failure" if (final_state and final_state.get("route") == "terminal_failure")
                else "exception" if exception
                else "incomplete"
            ),
        }
        log_path = self._workspace.log_path(self._run_id)
        _atomic_write_json(log_path, run_trace)

        # ── DGM Lineage archive ───────────────────────────────────────────────
        if final_state and final_state.get("lineage"):
            lineage_data: Dict[str, Any] = {
                "schema_version": LOG_SCHEMA_VERSION,
                "user_id": self._user_id,
                "run_id": self._run_id,
                "entries": list(final_state["lineage"]),
            }
            lineage_path = self._workspace.lineage_path(self._run_id)
            _atomic_write_json(lineage_path, lineage_data)

        # ── Update aggregated meta_stats for outer-loop optimizer ─────────────
        self._update_meta_stats(final_state)

        return log_path

    def _update_meta_stats(self, final_state: Optional[JobTayariHarnessState]) -> None:
        """
        Update meta_stats.json with failure rates per signature class.
        This is the key data structure that enables the Meta-Harness outer-loop
        optimizer to improve prompts from failure distributions.

        Serializes the entire read-modify-write with a per-user advisory lock
        (fcntl.flock) to prevent concurrent writers from losing updates.
        """
        stats_path = self._workspace.meta_stats_path()
        lock_path = stats_path.with_suffix(".lock")
        lock_fd = open(lock_path, "a+")
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
            # Load existing stats
            try:
                with open(stats_path, "r", encoding="utf-8") as f:
                    stats: Dict[str, Any] = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                stats = {
                    "schema_version": LOG_SCHEMA_VERSION,
                    "user_id": self._user_id,
                    "total_runs": 0,
                    "successful_runs": 0,
                    "terminal_failure_runs": 0,
                    "by_signature": {},
                }

            stats["total_runs"] = stats.get("total_runs", 0) + 1

            if final_state:
                sig = final_state.get("dspy_signature_class", "unknown")
                by_sig = stats.setdefault("by_signature", {})
                sig_stats = by_sig.setdefault(sig, {
                    "total": 0, "success": 0, "failure": 0,
                    "avg_iterations": 0.0, "failure_rate": 0.0,
                })
                sig_stats["total"] += 1

                if final_state.get("validation_passed"):
                    stats["successful_runs"] = stats.get("successful_runs", 0) + 1
                    sig_stats["success"] += 1
                elif final_state.get("route") == "terminal_failure":
                    stats["terminal_failure_runs"] = stats.get("terminal_failure_runs", 0) + 1
                    sig_stats["failure"] += 1

                # Rolling average iterations
                iters = final_state.get("current_iteration", 0)
                prev_avg = sig_stats["avg_iterations"]
                total = sig_stats["total"]
                sig_stats["avg_iterations"] = round(
                    (prev_avg * (total - 1) + iters) / total, 3
                )
                sig_stats["failure_rate"] = round(
                    sig_stats["failure"] / max(sig_stats["total"], 1), 4
                )

            _atomic_write_json(stats_path, stats)
        finally:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
            except Exception:
                pass
            lock_fd.close()


# ── Outer-loop optimizer helpers ──────────────────────────────────────────────

def load_run_trace(user_id: str, run_id: str) -> Dict[str, Any]:
    """
    Load a run trace JSON file for the outer-loop optimizer.
    Returns empty dict if file not found.
    """
    workspace = TenantWorkspace(user_id)
    path = workspace.log_path(run_id)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def evaluate_failure_traces(user_id: str) -> Dict[str, Any]:
    """
    Load and analyze ALL run traces for a user to support outer-loop optimization.

    Returns a summary of:
    - Overall success rate
    - Failure rates per DSPy signature class
    - Most common validation errors (for prompt debugging)
    - List of run_ids that terminated with failures (for trace replay)

    This is the primary input to the Meta-Harness self-evolution layer.
    """
    workspace = TenantWorkspace(user_id)
    logs_dir = workspace.logs_dir

    summary: Dict[str, Any] = {
        "user_id": user_id,
        "total_runs_analyzed": 0,
        "success_rate": 0.0,
        "terminal_failure_rate": 0.0,
        "by_signature": {},
        "common_errors": [],
        "failed_run_ids": [],
    }

    run_files = list(logs_dir.glob("run_*.json"))
    if not run_files:
        return summary

    successes = 0
    terminal_failures = 0
    error_counts: Dict[str, int] = {}
    failed_run_ids: List[str] = []

    for run_file in run_files:
        try:
            with open(run_file, "r", encoding="utf-8") as f:
                trace = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        summary["total_runs_analyzed"] += 1
        outcome = trace.get("outcome", "incomplete")

        if outcome == "success":
            successes += 1
        elif outcome == "terminal_failure":
            terminal_failures += 1
            failed_run_ids.append(trace.get("run_id", run_file.stem))

        # Collect validation errors from steps
        for step in trace.get("steps", []):
            err = step.get("error_trace")
            if err:
                # Extract first line as error key
                first_line = str(err).split("\n")[0][:100]
                error_counts[first_line] = error_counts.get(first_line, 0) + 1

    total = summary["total_runs_analyzed"]
    if total > 0:
        summary["success_rate"] = round(successes / total, 4)
        summary["terminal_failure_rate"] = round(terminal_failures / total, 4)

    summary["failed_run_ids"] = failed_run_ids
    summary["common_errors"] = sorted(
        [{"error": k, "count": v} for k, v in error_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # Load per-signature stats from meta_stats.json
    meta_path = workspace.meta_stats_path()
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            summary["by_signature"] = meta.get("by_signature", {})
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    return summary
