import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError } from "./_client";

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
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    try {
      const data = await callApi(ctx, "/api/v1/career-intelligence/salary-benchmark", {
        body: { target_role, location },
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
