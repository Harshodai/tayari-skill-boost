import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FitMatrixCard, FitMatrixData } from "@/components/jobs/FitMatrixCard";
import { ScenarioPlanner } from "@/components/career/ScenarioPlanner";
import { FunnelStepper } from "@/components/layout/FunnelStepper";

describe("FitMatrixCard Component", () => {
  const mockFit: FitMatrixData = {
    hard_constraints: { pass: true, reason: "All passed" },
    skill_alignment: {
      score: 85,
      strong_skills: ["Python", "AWS"],
      missing_skills: ["Docker"],
      evidence: "Matched 2 of 3",
    },
    seniority_alignment: { result: "aligned", basis: "Matching level" },
    evidence_strength: { level: "high", source_count: 4 },
    freshness: { state: "current", last_checked: new Date().toISOString() },
    recommendation: {
      action: "strong_match",
      why: "Strong profile overlap",
      what_would_change: "Candidate is competitive",
    },
  };

  it("renders recommendation badge and skill overlap", () => {
    render(<FitMatrixCard fitMatrix={mockFit} />);
    expect(screen.getByText(/strong match/i)).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText(/hard constraints passed/i)).toBeInTheDocument();
  });

  it("renders with unknown seniority alignment using neutral/unverified progress representation", () => {
    const unknownFit: FitMatrixData = {
      ...mockFit,
      seniority_alignment: { result: "unknown", basis: "Seniority unknown" },
    };
    render(<FitMatrixCard fitMatrix={unknownFit} />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
    const seniorityProgress = screen.getByLabelText("Seniority alignment");
    expect(seniorityProgress).toHaveAttribute("aria-valuenow", "0");
  });

  it("handles missing seniority alignment gracefully with unverified representation", () => {
    const fitWithoutSeniority: FitMatrixData = {
      ...mockFit,
      seniority_alignment: undefined,
    };
    render(<FitMatrixCard fitMatrix={fitWithoutSeniority} />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
    const seniorityProgress = screen.getByLabelText("Seniority alignment");
    expect(seniorityProgress).toHaveAttribute("aria-valuenow", "0");
  });

  it("maps seniority levels correctly to progress values and distinguishes unknown from under", () => {
    const { rerender } = render(
      <FitMatrixCard
        fitMatrix={{
          ...mockFit,
          seniority_alignment: { result: "aligned", basis: "aligned" },
        }}
      />
    );
    expect(screen.getByLabelText("Seniority alignment")).toHaveAttribute("aria-valuenow", "100");

    rerender(
      <FitMatrixCard
        fitMatrix={{
          ...mockFit,
          seniority_alignment: { result: "over", basis: "over" },
        }}
      />
    );
    expect(screen.getByLabelText("Seniority alignment")).toHaveAttribute("aria-valuenow", "85");

    rerender(
      <FitMatrixCard
        fitMatrix={{
          ...mockFit,
          seniority_alignment: { result: "under", basis: "under" },
        }}
      />
    );
    expect(screen.getByLabelText("Seniority alignment")).toHaveAttribute("aria-valuenow", "45");

    rerender(
      <FitMatrixCard
        fitMatrix={{
          ...mockFit,
          seniority_alignment: { result: "unknown", basis: "unknown" },
        }}
      />
    );
    expect(screen.getByLabelText("Seniority alignment")).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("ScenarioPlanner Component", () => {
  it("renders scenario selector and transferable strengths from a backend plan", () => {
    render(
      <ScenarioPlanner
        initialPlan={{
          scenario: "role_change",
          scenario_title: "Role Transition",
          plan_version: "test-v1",
          confidence: "high",
          generated_at: new Date().toISOString(),
          transferable_skills: [
            { skill: "API Design", evidence: "Shipped public APIs", confidence: 0.9 },
          ],
          missing_skills: [
            { skill: "GraphQL", effort_weeks: 2, learning_path: ["Read GraphQL docs"] },
          ],
          available_roles: [],
          next_action: "Ship a GraphQL prototype.",
        }}
      />
    );
    expect(screen.getAllByText(/Role Transition/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Transferable Core Strengths/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH CONFIDENCE/i)).toBeInTheDocument();
  });

  it("renders an honest empty state when the backend returns no plan", () => {
    render(<ScenarioPlanner initialPlan={undefined} />);
    expect(screen.getAllByText(/Role Transition/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Transferable Core Strengths/i)).not.toBeInTheDocument();
  });
});

describe("FunnelStepper Component", () => {
  it("renders 6 lifecycle steps", () => {
    render(<FunnelStepper currentStepId="fit" completedStepIds={["resume"]} />);
    expect(screen.getByText(/1\. Resume/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Fit Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/6\. Interview Prep/i)).toBeInTheDocument();
  });
});
