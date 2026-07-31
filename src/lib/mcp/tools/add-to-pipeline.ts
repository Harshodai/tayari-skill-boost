import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const API = () => process.env.VITE_GO_API_URL ?? "http://localhost:8085";

export default defineTool({
  name: "add_to_pipeline",
  title: "Add job to pipeline",
  description: "Add a job to the user's application pipeline (kanban board).",
  inputSchema: {
    title: z.string().describe("Job title"),
    company: z.string().describe("Company name"),
    url: z.string().url().optional().describe("Job listing URL"),
    location: z.string().optional(),
    description: z.string().optional().describe("Job description text"),
    stage: z.enum(["saved","applied","screening"]).optional().default("saved"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, company, url, location, description, stage }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let resp: Response;
    try {
      resp = await fetch(`${API()}/api/v1/extension/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
        body: JSON.stringify({ title, company, url, location, description, stage, add_to_board: true }),
      });
    } catch (err) {
      return { content: [{ type: "text", text: `Network error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
    let data;
    try {
      data = await resp.json();
    } catch (err) {
      return { content: [{ type: "text", text: `Invalid response from server: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
    if (!resp.ok) return { content: [{ type: "text", text: data.error ?? "Failed" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
