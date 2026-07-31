import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

export default defineTool({
  name: "get_market_salary",
  title: "Get market salary",
  description: "Get salary benchmarks for a role in a given location. Returns p25, median, p75, and total compensation breakdown.",
  inputSchema: {
    target_role: z.string().describe("Job title/role e.g. 'Senior Software Engineer'"),
    location: z.string().optional().default("US").describe("Location e.g. 'San Francisco, CA' or country code"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ target_role, location }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const resp = await fetch(`${API()}/api/v1/career-intelligence/salary-benchmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ target_role, location }),
    });
    const data = await resp.json();
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
