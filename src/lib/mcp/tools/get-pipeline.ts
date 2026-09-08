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
  name: "get_pipeline",
  title: "Get application pipeline",
  description: "List all job applications in the user's pipeline, optionally filtered by stage.",
  inputSchema: {
    stage: z.enum(["saved","applied","screening","interview","offer","rejected","accepted"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
      return { content: [{ type: "text", text: "Server misconfigured: SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY not set" }], isError: true };
    }
    // saved_jobs is the pipeline table of record; the previously referenced
    // "applications" table does not exist, so this tool always errored.
    // user_id is filtered explicitly (defence in depth alongside RLS).
    let q = sb(ctx).from("saved_jobs")
      .select("id,title,company,location,url,stage,created_at,updated_at")
      .eq("user_id", ctx.getUserId())
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (stage) q = q.eq("stage", stage);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { applications: data ?? [] } };
  },
});
