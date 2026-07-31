import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

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
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const resp = await fetch(`${API()}/api/v1/cover-letter/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ resume_id, job_description, company_name, tone }),
    });
    const data = await resp.json();
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
