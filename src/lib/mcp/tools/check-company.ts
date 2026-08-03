import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError } from "./_client";

export default defineTool({
  name: "check_company",
  title: "Check company",
  description: "Look up company information including culture signals, review patterns, ATS used, and known hiring contacts.",
  inputSchema: {
    company_name: z.string().describe("Company name to look up"),
    job_url: z.string().url().optional().describe("Optional job posting URL for more context"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ company_name, job_url }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    try {
      const data = await callApi(ctx, "/api/v1/agent-reach/doctor", {
        body: { company: company_name, url: job_url },
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
