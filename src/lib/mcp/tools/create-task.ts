import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, requireMcpWriteTool, toolError } from "./_client";

export default defineTool({
  name: "create_task",
  title: "Create durable task",
  description: "Create a candidate-owned review-first task. Creation records intent only; it never submits, sends, or changes an external system.",
  inputSchema: {
    title: z.string().trim().min(1).max(240),
    objective: z.string().trim().min(1).max(10000),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, objective }, ctx) => {
    const denied = requireMcpWriteTool(ctx, "create_task");
    if (denied) return denied;
    try {
      const data = await callApi(ctx, "/api/v1/tasks", { body: { title, objective } });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { task: data } };
    } catch (error) {
      return toolError(error instanceof Error ? error.message : "Task creation failed");
    }
  },
});
