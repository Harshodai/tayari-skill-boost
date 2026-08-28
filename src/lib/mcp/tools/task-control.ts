import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callApi, requireMcpWriteTool, toolError } from "./_client";

const taskId = z.string().uuid();

async function writeTaskAction(ctx: ToolContext, name: string, path: string) {
  const denied = requireMcpWriteTool(ctx, name);
  if (denied) return denied;
  try {
    const data = await callApi(ctx, path);
    return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { task: data } };
  } catch (error) {
    return toolError(error instanceof Error ? error.message : `${name} failed`);
  }
}

export const getTaskTool = defineTool({
  name: "get_task",
  title: "Get durable task",
  description: "Read the signed-in user's durable task status and lifecycle state.",
  inputSchema: { task_id: taskId },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id }, ctx) => {
    try {
      const data = await callApi(ctx, `/api/v1/tasks/${encodeURIComponent(task_id)}`, { method: "GET" });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { task: data } };
    } catch (error) {
      return toolError(error instanceof Error ? error.message : "Task lookup failed");
    }
  },
});

export const approveTaskTool = defineTool({
  name: "approve_task_plan",
  title: "Approve task plan",
  description: "Approve the latest candidate-owned task plan so the existing durable draft executor can run it. This never authorizes submission or external writes.",
  inputSchema: { task_id: taskId },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ task_id }, ctx) => writeTaskAction(ctx, "approve_task_plan", `/api/v1/tasks/${encodeURIComponent(task_id)}/plan/approve`),
});

export const stopTaskTool = defineTool({
  name: "stop_task",
  title: "Stop durable task",
  description: "Request server-side stop for a candidate-owned durable task.",
  inputSchema: { task_id: taskId },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id }, ctx) => writeTaskAction(ctx, "stop_task", `/api/v1/tasks/${encodeURIComponent(task_id)}/stop`),
});

export const getTaskArtifactsTool = defineTool({
  name: "get_task_artifacts",
  title: "Get task artifacts",
  description: "Read the reviewable artifacts produced by the existing configured task executor; no artifact is fabricated when execution failed or is incomplete.",
  inputSchema: { task_id: taskId },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id }, ctx) => {
    try {
      const data = await callApi(ctx, `/api/v1/tasks/${encodeURIComponent(task_id)}/artifacts`, { method: "GET" });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { artifacts: data } };
    } catch (error) {
      return toolError(error instanceof Error ? error.message : "Task artifacts lookup failed");
    }
  },
});
