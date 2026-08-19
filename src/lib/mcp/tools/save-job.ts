import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireMcpWriteTool } from "./_write-gate";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "save_job",
  title: "Save a job",
  description: "Save a job to the signed-in user's saved list / Interview Board.",
  inputSchema: {
    title: z.string().trim().min(1),
    company: z.string().trim().min(1),
    location: z.string().optional(),
    url: z.string().url().optional(),
    description: z.string().optional(),
    status: z
      .enum(["saved", "applied", "phone_screen", "interview", "offer", "rejected"])
      .optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, company, location, url, description, status }, ctx) => {
    const gate = requireMcpWriteTool(ctx, "save_job");
    if (gate) return gate;
    const { data, error } = await sb(ctx)
      .from("saved_jobs")
      .insert({
        user_id: ctx.getUserId(),
        title,
        company,
        location: location ?? null,
        url: url ?? null,
        description: description ?? null,
        status: status ?? "saved",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved ${title} at ${company}` }],
      structuredContent: { row: data },
    };
  },
});
