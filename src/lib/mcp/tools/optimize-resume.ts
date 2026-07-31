import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError, REQUEST_TIMEOUT_MS } from "./_client";

export default defineTool({
  name: "optimize_resume",
  title: "Optimize resume",
  description: "Tailor the user's resume to a specific job description using AI. Returns the optimized resume text and a list of changes made.",
  inputSchema: {
    resume_id: z.number().int().describe("ID of the resume to optimize"),
    job_description: z.string().min(20).describe("The target job description text"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ resume_id, job_description }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    try {
      // LLM optimization is slow — explicit timeout instead of the default.
      const data = await callApi(ctx, `/api/v1/resumes/${resume_id}/optimize`, {
        body: { job_description },
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
