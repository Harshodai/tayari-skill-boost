import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, requireMcpWriteTool, toolError } from "./_client";

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
    const gate = requireMcpWriteTool(ctx, "report_outcome");
    if (gate) return gate;
    if (!ctx.isAuthenticated()) return toolError("Not authenticated");
    if (Object.keys(rest).length === 0) {
      return toolError("At least one outcome field is required");
    }
    try {
      const data = await callApi(ctx, `/api/v1/applications/${application_id}/outcome`, {
        body: rest,
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  },
});
