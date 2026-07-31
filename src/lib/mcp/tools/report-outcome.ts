import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

export default defineTool({
  name: "report_outcome",
  title: "Report application outcome",
  description: "Record the real-world outcome of a job application (recruiter replied, got interview, received offer, etc.). Used to improve autopilot accuracy.",
  inputSchema: {
    application_id: z.string().uuid().describe("Application UUID"),
    recruiter_reply: z.boolean().optional(),
    phone_screen: z.boolean().optional(),
    technical_interview: z.boolean().optional(),
    final_interview: z.boolean().optional(),
    offer_received: z.boolean().optional(),
    offer_accepted: z.boolean().optional(),
    salary_offered: z.number().optional().describe("Offered salary in USD"),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ application_id, ...rest }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const resp = await fetch(`${API()}/api/v1/applications/${application_id}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify(rest),
    });
    const data = await resp.json();
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
