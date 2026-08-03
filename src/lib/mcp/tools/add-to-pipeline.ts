import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError } from "./_client";

export default defineTool({
  name: "add_to_pipeline",
  title: "Add job to pipeline",
  description: "Add a job to the user's application pipeline (kanban board).",
  inputSchema: {
    title: z.string().describe("Job title"),
    company: z.string().describe("Company name"),
    url: z.string().url().optional().describe("Job listing URL"),
    location: z.string().optional(),
    description: z.string().optional().describe("Job description text"),
    stage: z.enum(["saved","applied","screening"]).optional().default("saved"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, company, url, location, description, stage }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    try {
      const data = await callApi(ctx, "/api/v1/extension/capture", {
        body: { title, company, url, location, description, stage, add_to_board: true },
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
