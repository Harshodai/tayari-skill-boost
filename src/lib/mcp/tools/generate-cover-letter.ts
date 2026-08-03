import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError } from "./_client";

export default defineTool({
  name: "generate_cover_letter",
  title: "Generate cover letter",
  description: "Generate a tailored cover letter for a job application based on the user's resume.",
  inputSchema: {
    resume_id: z.number().int().describe("Resume ID to base the cover letter on"),
    job_description: z.string().min(20).describe("Target job description"),
    company_name: z.string().optional().describe("Company name for personalization"),
    tone: z.enum(["professional", "friendly", "confident"]).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ resume_id, job_description, company_name, tone }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    try {
      const data = await callApi(ctx, "/api/v1/cover-letter/generate", {
        body: { resume_id, job_description, company_name, tone },
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
