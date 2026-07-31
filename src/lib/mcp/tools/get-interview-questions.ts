import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError } from "./_client";

export default defineTool({
  name: "get_interview_questions",
  title: "Get interview questions",
  description: "Generate likely interview questions for a role and company, with guidance on how to answer each one.",
  inputSchema: {
    resume_id: z.number().int().describe("Resume ID to tailor questions to"),
    job_description: z.string().min(20).describe("Target job description"),
    company: z.string().optional().describe("Company name for company-specific questions"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ resume_id, job_description, company }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    try {
      const data = await callApi(ctx, "/api/v1/interview/prep", {
        body: { resume_id, job_description, company },
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
