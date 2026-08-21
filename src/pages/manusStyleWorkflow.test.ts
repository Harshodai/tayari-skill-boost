import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Manus-style task workflow contracts", () => {
  it("routes natural-language intake into a durable reviewed task", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/DesktopAgent.tsx"), "utf8");

    expect(source).toContain("createTask({");
    expect(source).toContain("createTaskPlan(created.id");
    expect(source).toContain("requires_approval: true");
    expect(source).toContain("navigate(`/tay/tasks/${created.id}`)");
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
  });
});
