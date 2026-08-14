"""Credential-free contract checks for the standalone Tayari MCP gateway."""

from __future__ import annotations

import os
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MCP_DIR = REPO_ROOT / "integrations" / "jobtheory_mcp"
sys.path.insert(0, str(MCP_DIR))

os.environ.setdefault("TAYARI_API_KEY", "ci-placeholder")
os.environ.setdefault("TAYARI_API_URL", "http://127.0.0.1:8085")

from server import _validated_api_url, mcp  # noqa: E402


assert len(mcp._tool_manager.list_tools()) >= 1

for safe_url in ("https://api.example.com", "http://127.0.0.1:8085", "http://go-backend:8085"):
    assert _validated_api_url(safe_url) == safe_url

for unsafe_url in (
    "file:///etc/passwd",
    "ftp://example.com/api",
    "http://example.com/api",
    "https://user:password@example.com/api",
):
    try:
        _validated_api_url(unsafe_url)
    except RuntimeError:
        continue
    raise AssertionError(f"unsafe MCP gateway URL was accepted: {unsafe_url}")

print("MCP contract: PASS")
