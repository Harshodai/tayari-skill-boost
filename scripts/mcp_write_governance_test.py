"""Static adversarial checks for the canonical MCP write boundary."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MCP = (ROOT / "supabase/functions/mcp/index.ts").read_text()
LEGACY = (ROOT / "backend/python/app/agent/mcp_manager.py").read_text()
ROUTE = (ROOT / "backend/python/app/routes/agent.py").read_text()

WRITE_TOOLS = (
    "save_job",
    "add_to_pipeline",
    "optimize_resume",
    "generate_cover_letter",
    "report_outcome",
)

assert 'function requireMcpWriteTool(ctx, toolName)' in MCP
assert 'capability: "mcp.write_tools"' in MCP
assert 'code: "disabled_by_launch_scope"' in MCP
assert 'CAPABILITY_MCP_WRITE_TOOLS' in MCP

for tool in WRITE_TOOLS:
    marker = f'requireMcpWriteTool(ctx, "{tool}")'
    assert MCP.count(marker) == 1, f"missing or duplicate gate for {tool}"
    tool_start = MCP.index(f'name: "{tool}"')
    tool_end = MCP.find('\n});', tool_start)
    assert tool_end > tool_start
    tool_block = MCP[tool_start:tool_end]
    assert "annotations: { readOnlyHint: false" in tool_block, f"annotation drift for {tool}"
    assert marker in tool_block, f"handler gate drift for {tool}"

assert "public: bool = False" in LEGACY
assert "def list_public_tools" in LEGACY
assert '"internalOnly": not self.public' in LEGACY
assert '"legacy_registry_public": False' in ROUTE
assert '"canonical_mcp_endpoint": "supabase:function:mcp"' in ROUTE

print("MCP write governance contract: PASS")
