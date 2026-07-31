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
    let q = sb(ctx).from("applications")
      .select("application_id,title,company,stage,status,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (stage) q = q.eq("stage", stage);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { applications: data ?? [] } };
  },
});
