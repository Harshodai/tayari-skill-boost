import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

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
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const resp = await fetch(`${API()}/api/v1/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ resume_text, job_description }),
    });
    const data = await resp.json();
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
