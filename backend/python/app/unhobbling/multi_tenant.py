"""
Multi-Tenant Workspace Isolation — qm Architecture (yc-software/qm).

Implements the per-user workspace isolation pattern from the qm harness:
- Each user gets an isolated workspace directory: {TAYARI_WORKSPACE_DIR}/{user_id}/
- Memory namespace is prefixed per user — no cross-user key collisions.
- Credentials are never shared across tenant boundaries.
- Log paths are scoped: {TAYARI_LOGS_DIR}/{user_id}/run_{run_id}.json
- Cron job state keys are prefixed with user_id.

Design goals:
- Zero cross-user contamination — even if user_ids are similar strings.
- All path operations are validated to stay within the user's directory.
- Workspace directories are created lazily on first access.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

# Root directories — configurable via environment variables (Docker-safe)
_DEFAULT_WORKSPACE_ROOT = Path(os.environ.get(
    "TAYARI_WORKSPACE_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tayari_workspace"),
)).resolve()

_DEFAULT_LOGS_ROOT = Path(os.environ.get(
    "TAYARI_LOGS_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "tayari_logs"),
)).resolve()

# Strict user_id validation: alphanumeric, hyphens, underscores only
# This prevents path traversal (e.g. user_id = "../../etc")
_SAFE_USER_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")


def _validate_user_id(user_id: str) -> None:
    """Raise ValueError if user_id is not safe for filesystem path use."""
    if not _SAFE_USER_ID_RE.match(user_id):
        raise ValueError(
            f"user_id '{user_id}' contains invalid characters. "
            "Only alphanumeric, hyphen, and underscore are allowed."
        )


class TenantWorkspace:
    """
    Per-user isolated workspace context (qm model).

    Usage:
        workspace = TenantWorkspace(user_id="user-abc123")
        workspace_path = workspace.workspace_dir  # tayari_workspace/user-abc123/
        log_path = workspace.log_path("run-xyz")  # tayari_logs/user-abc123/run_run-xyz.json
    """

    def __init__(
        self,
        user_id: str,
        workspace_root: Optional[Path] = None,
        logs_root: Optional[Path] = None,
    ) -> None:
        _validate_user_id(user_id)
        self.user_id = user_id
        self._workspace_root = workspace_root or _DEFAULT_WORKSPACE_ROOT
        self._logs_root = logs_root or _DEFAULT_LOGS_ROOT

    @property
    def workspace_dir(self) -> Path:
        """Isolated workspace directory for this user. Created on first access."""
        path = self._workspace_root / self.user_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def logs_dir(self) -> Path:
        """Isolated log directory for this user. Created on first access."""
        path = self._logs_root / self.user_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def log_path(self, run_id: str) -> Path:
        """Full path for the run trace JSON file."""
        return self.logs_dir / f"run_{run_id}.json"

    def lineage_path(self, run_id: str) -> Path:
        """Full path for the DGM lineage JSON file."""
        return self.logs_dir / f"lineage_{run_id}.json"

    def meta_stats_path(self) -> Path:
        """Aggregated failure rate stats file for the outer-loop optimizer."""
        return self.logs_dir / "meta_stats.json"

    def memory_namespace(self, key: str) -> str:
        """Prefix a memory key with user_id to prevent cross-user collisions."""
        return f"user:{self.user_id}:{key}"

    def scoped_env(self, base_env: Optional[dict] = None) -> dict:
        """
        Return a sanitized environment dict scoped to this user.
        Never leaks production secrets — only user-scoped context is added.
        """
        safe: dict = {}
        if base_env:
            # Only propagate known-safe keys
            safe_keys = {"PATH", "LANG", "LC_ALL", "TMPDIR", "TEMP", "TMP"}
            for k in safe_keys:
                if k in base_env:
                    safe[k] = base_env[k]
        safe["TAYARI_USER_ID"] = self.user_id
        safe["TAYARI_WORKSPACE"] = str(self.workspace_dir)
        return safe

    def is_within_workspace(self, target_path: Path) -> bool:
        """Validate that target_path is within this user's workspace."""
        try:
            target_path.resolve().relative_to(self.workspace_dir.resolve())
            return True
        except ValueError:
            return False

    def resolve_workspace_path(self, relative_path: str) -> Path:
        """Safely resolve a relative path within this user's workspace."""
        full = (self.workspace_dir / relative_path).resolve()
        if not self.is_within_workspace(full):
            raise PermissionError(
                f"Path '{relative_path}' resolves outside user workspace boundary."
            )
        return full
