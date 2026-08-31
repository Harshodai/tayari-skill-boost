import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_saved_jobs",
  title: "Search saved jobs",
  description: "Search the signed-in user's saved jobs by title, company, or keyword.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to match against title/company/description"),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sanitizedQuery = query.replace(/[(),"%:]/g, "").trim();
    if (!sanitizedQuery) {
      return {
        content: [{ type: "text", text: JSON.stringify([]) }],
        structuredContent: { rows: [] },
      };
    }
    const client = sb(ctx);
    const { data, error } = await client
      .from("saved_jobs")
      .select("id,title,company,location,url,status,created_at")
      .eq("user_id", ctx.getUserId())
      .or(`title.ilike.%${sanitizedQuery}%,company.ilike.%${sanitizedQuery}%`)
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
