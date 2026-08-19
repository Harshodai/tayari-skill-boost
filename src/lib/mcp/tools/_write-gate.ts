import type { ToolContext } from "@lovable.dev/mcp-js";

type ToolError = {
  content: [{ type: "text"; text: string }];
  isError: true;
  structuredContent: {
    code: "disabled_by_launch_scope";
    capability: "mcp.write_tools";
    tool: string;
    reason: string;
  };
};

/**
 * Server-side launch gate for every MCP write tool.
 *
 * Authentication alone is not sufficient: write capability is explicitly
 * disabled unless the deployment opts in, and the context must expose both a
 * verified token and a verified owner identity. The helper is intentionally
 * fail-closed and uses globalThis for runtime portability in Deno bundles.
 */
export function requireMcpWriteTool(ctx: ToolContext, toolName: string): ToolError | null {
  const denied = (reason: string): ToolError => {
    const detail = {
      code: "disabled_by_launch_scope" as const,
      capability: "mcp.write_tools" as const,
      tool: toolName,
      reason,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(detail) }],
      isError: true,
      structuredContent: detail,
    };
  };

  if (!ctx.isAuthenticated() || !ctx.getUserId?.() || !ctx.getToken?.()) {
    return denied("authenticated MCP context required");
  }

  const raw = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } })
    .Deno?.env?.get?.("CAPABILITY_MCP_WRITE_TOOLS")
    ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.CAPABILITY_MCP_WRITE_TOOLS;
  if (!["1", "true", "yes", "on"].includes(String(raw ?? "").trim().toLowerCase())) {
    return denied("MCP write tools are disabled by launch scope");
  }
  return null;
}
