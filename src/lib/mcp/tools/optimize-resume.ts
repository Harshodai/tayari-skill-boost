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

    const OPTIMIZE_TIMEOUT_MS = 60_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPTIMIZE_TIMEOUT_MS);

    let resp: Response;
    try {
      resp = await fetch(`${API()}/api/v1/resumes/${resume_id}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
        body: JSON.stringify({ job_description }),
        signal: controller.signal,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return {
        content: [{ type: "text", text: isTimeout ? "Request timed out" : `Network error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    } finally {
      clearTimeout(timeoutId);
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
