import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

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
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const resp = await fetch(`${API()}/api/v1/resumes/${resume_id}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ job_description }),
    });
    const data = await resp.json();
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
