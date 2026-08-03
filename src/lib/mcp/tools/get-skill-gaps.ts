import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, toolError } from "./_client";

export default defineTool({
  name: "get_skill_gaps",
  title: "Get skill gaps",
  description: "Analyze skill gaps between the user's resume and a target role or job description. Returns matched skills, missing skills, and a learning path.",
  inputSchema: {
    resume_id: z.number().int().optional().describe("Resume ID (uses latest if omitted)"),
    job_description_text: z.string().optional().describe("Job description text"),
    target_role: z.string().optional().describe("Target role e.g. 'Staff Engineer'"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    if (!args.job_description_text && !args.target_role) {
      return toolError("At least one of job_description_text or target_role is required");
    }
    try {
      // Build the body explicitly — the Go handler only reads
      // resume_id/job_description_text/target_role, so don't forward
      // arbitrary args verbatim.
      const data = await callApi(ctx, "/api/v1/career-intelligence/skills-gap", {
        body: {
          resume_id: args.resume_id,
          job_description_text: args.job_description_text,
          target_role: args.target_role,
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
