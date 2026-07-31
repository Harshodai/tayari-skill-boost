import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

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
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const resp = await fetch(`${API()}/api/v1/interview/prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ resume_id, job_description, company }),
    });
    const data = await resp.json();
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
