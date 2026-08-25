import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Manus-style task workflow contracts", () => {
  it("routes natural-language intake into a durable reviewed task", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/DesktopAgent.tsx"), "utf8");
    const recipes = readFileSync(resolve(process.cwd(), "src/lib/agent/taskRecipes.ts"), "utf8");

    expect(source).toContain("createTask({");
    expect(source).toContain("createTaskPlan(created.id");
    expect(source).toContain("toTaskPlanSteps(recipe)");
    expect(source).toContain("navigate(`/tay/tasks/${created.id}`)");
    expect(recipes).toContain("candidate_context.read");
    expect(recipes).toContain("risk_tier: \"read\"");
    expect(recipes).toContain("requires_approval: true");
    expect(recipes).not.toContain('risk_tier: "submission"');
  });

  it("keeps execution controls and submission boundaries in the control room", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/TaskControlRoom.tsx"), "utf8");

    expect(source).toContain("pause");
    expect(source).toContain("resume");
    expect(source).toContain("Take over");
    expect(source).toContain("Task stopped");
    expect(source).toContain("Submission remains blocked");
    expect(source).toContain("Live task events");
    expect(source).toContain("Proposed plan");
    expect(source).toContain("Review these exact steps before approving");
    expect(source).toContain("durable artifact");
    expect(source).toContain("Task data may be stale");
    expect(source).toContain('to="/tay"');
    expect(source).not.toContain('to="/desktop"');
    expect(source).toContain("Do not approve or treat an empty result as final");
  });

  it("does not silently convert control-room refresh failures into empty state", () => {
    const context = readFileSync(resolve(process.cwd(), "src/contexts/TaskControlContext.tsx"), "utf8");
    expect(context).toContain("refreshError");
    expect(context).toContain("listTaskArtifacts(taskId)");
    expect(context).not.toContain("listTaskArtifacts(taskId).catch(() => ({ artifacts: [] }))");
  });
});
