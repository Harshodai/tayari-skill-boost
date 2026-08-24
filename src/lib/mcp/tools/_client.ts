import type { ToolContext } from "@lovable.dev/mcp-js";

function runtimeGoApiUrl(): string {
  const runtime = (globalThis as {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
  }).Deno?.env?.get?.("TAYARI_GO_API_URL");
  return runtime ?? "";
}

const API = () => {
  const configured = String(runtimeGoApiUrl()).trim();
  if (configured) return configured;
  throw new Error("MCP Go API URL is not configured");
};

export const REQUEST_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  data?: unknown;
}

// Single shared path for every Go-API-backed MCP tool: builds the request
// (base URL, JSON headers, bearer token), applies a timeout, parses the JSON
// body, and maps failures to thrown errors so every handler can return the
// same isError shape via toolError().
export async function callApi(
  ctx: ToolContext,
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(`${API()}${path}`, {
      method: options.method ?? "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    throw new Error(
      isTimeout ? `Request timed out after ${timeoutMs}ms` : `Network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch (err) {
    throw new Error(`Invalid response from server: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!resp.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? ((data as { error: string }).error || "Failed")
        : "Failed";
    const err = new ApiError(msg);
    err.data = data;
    throw err;
  }
  return data;
}

export function toolError(text: string, structuredContent?: Record<string, unknown>): { content: { type: "text"; text: string }[]; isError: true; structuredContent?: Record<string, unknown> } {
  return { content: [{ type: "text", text }], ...(structuredContent === undefined ? {} : { structuredContent }), isError: true };
}

export function requireMcpWriteTool(ctx: ToolContext, toolName: string) {
  if (!ctx.isAuthenticated() || !ctx.getUserId?.() || !ctx.getToken?.()) {
    return toolError("authenticated MCP context required");
  }
  const runtime = (globalThis as {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
  }).Deno?.env?.get?.("CAPABILITY_MCP_WRITE_TOOLS")
    ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.CAPABILITY_MCP_WRITE_TOOLS
    ?? "";
  if (!["1", "true", "yes", "on"].includes(String(runtime).trim().toLowerCase())) {
    const detail = {
      code: "disabled_by_launch_scope",
      capability: "mcp.write_tools",
      tool: toolName,
      reason: "MCP write tools are disabled by launch scope",
    };
    return toolError(JSON.stringify(detail), detail);
  }
  return null;
}
