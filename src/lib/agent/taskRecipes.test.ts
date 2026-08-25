import { describe, expect, it } from "vitest";
import { TASK_RECIPES, getTaskRecipe, toTaskPlanSteps } from "./taskRecipes";

describe("desktop automation recipes", () => {
  it("exposes a focused set of high-value career lanes", () => {
    expect(TASK_RECIPES.map((recipe) => recipe.id)).toEqual([
      "application_packet",
      "opportunity_sweep",
      "interview_sprint",
      "follow_up_radar",
    ]);
  });

  it("turns every lane into a bounded, review-first plan", () => {
    for (const recipe of TASK_RECIPES) {
      const steps = toTaskPlanSteps(recipe);
      expect(steps.length).toBeGreaterThanOrEqual(4);
      expect(steps.at(-1)?.requires_approval).toBe(true);
      expect(steps.some((step) => step.risk_tier === "submission")).toBe(false);
      expect(steps.filter((step) => step.tool).every((step) => step.tool === "candidate_context.read" && step.risk_tier === "read")).toBe(true);
    }
  });

  it("falls back to the application packet for unknown recipe ids", () => {
    expect(getTaskRecipe("not-a-real-recipe" as never).id).toBe("application_packet");
  });
});
