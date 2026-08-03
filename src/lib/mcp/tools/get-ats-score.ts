import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError } from "./_client";

export default defineTool({
  name: "get_ats_score",
  title: "Get ATS score",
  description: "Score a resume against a job description. Returns overall_score, match_score, missing_skills, and recommendations.",
  inputSchema: {
    resume_text: z.string().min(10).describe("Resume text to analyze"),
    job_description: z.string().min(20).describe("Job description to score against"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ resume_text, job_description }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    try {
      const data = await callApi(ctx, "/api/v1/analyze", {
        body: { resume_text, job_description },
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
