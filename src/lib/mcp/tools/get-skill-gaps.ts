import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

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
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const resp = await fetch(`${API()}/api/v1/career-intelligence/skills-gap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify(args),
    });
    const data = await resp.json();
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
