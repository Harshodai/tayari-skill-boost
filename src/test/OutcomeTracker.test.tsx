import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OutcomeTracker, OutcomeMetrics, OutcomeEvent } from "@/components/OutcomeTracker";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("OutcomeTracker Component (WP-09)", () => {
  it("renders empty state truthfully with sample size n=0 and zero confidence intervals", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OutcomeTracker
          initialAnalytics={{
            match_precision: {
              point_estimate: 0,
              point_percentage: 0,
              n: 0,
              successes: 0,
              margin_of_error: 0,
              margin_percentage: 0,
              lower: 0,
              upper: 0,
              display: "0% (n=0, ±0%)",
            },
            artifact_acceptance_rate: {
              point_estimate: 0,
              point_percentage: 0,
              n: 0,
              successes: 0,
              margin_of_error: 0,
              margin_percentage: 0,
              lower: 0,
              upper: 0,
              display: "0% (n=0, ±0%)",
            },
            repeat_workflow_rate: {
              point_estimate: 0,
              point_percentage: 0,
              n: 0,
              successes: 0,
              margin_of_error: 0,
              margin_percentage: 0,
              lower: 0,
              upper: 0,
              display: "0% (n=0, ±0%)",
            },
            sample_size: 0,
            candidate_confirmed_count: 0,
            externally_verified_count: 0,
          }}
          initialEvents={[]}
        />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("total-samples").textContent).toBe("0");
    expect(screen.getByTestId("candidate-confirmed-count").textContent).toBe("0");
    expect(screen.getByTestId("externally-verified-count").textContent).toBe("0");

    // Must never output bare percentages
    expect(screen.getByTestId("match-precision-display").textContent).toBe("0% (n=0, ±0%)");
    expect(screen.getByTestId("artifact-acceptance-display").textContent).toBe("0% (n=0, ±0%)");
    expect(screen.getByTestId("repeat-workflow-display").textContent).toBe("0% (n=0, ±0%)");
  });

  it("renders small sample sizes with explicit sample size n and margin of error", () => {
    const queryClient = createTestQueryClient();
    const mockAnalytics: OutcomeMetrics = {
      match_precision: {
        point_estimate: 0.63,
        point_percentage: 63,
        n: 12,
        successes: 8,
        margin_of_error: 0.14,
        margin_percentage: 14,
        lower: 0.49,
        upper: 0.77,
        display: "63% (n=12, ±14%)",
      },
      artifact_acceptance_rate: {
        point_estimate: 0.85,
        point_percentage: 85,
        n: 20,
        successes: 17,
        margin_of_error: 0.11,
        margin_percentage: 11,
        lower: 0.74,
        upper: 0.96,
        display: "85% (n=20, ±11%)",
      },
      repeat_workflow_rate: {
        point_estimate: 0.5,
        point_percentage: 50,
        n: 8,
        successes: 4,
        margin_of_error: 0.25,
        margin_percentage: 25,
        lower: 0.25,
        upper: 0.75,
        display: "50% (n=8, ±25%)",
      },
      sample_size: 12,
      candidate_confirmed_count: 10,
      externally_verified_count: 2,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <OutcomeTracker initialAnalytics={mockAnalytics} initialEvents={[]} />
      </QueryClientProvider>
    );

    // Assert that sample size and Wilson intervals are present
    const matchEl = screen.getByTestId("match-precision-display");
    expect(matchEl.textContent).toContain("63%");
    expect(matchEl.textContent).toContain("n=12");
    expect(matchEl.textContent).toContain("±14%");

    const artifactEl = screen.getByTestId("artifact-acceptance-display");
    expect(artifactEl.textContent).toContain("85%");
    expect(artifactEl.textContent).toContain("n=20");
    expect(artifactEl.textContent).toContain("±11%");

    const repeatEl = screen.getByTestId("repeat-workflow-display");
    expect(repeatEl.textContent).toContain("50%");
    expect(repeatEl.textContent).toContain("n=8");
    expect(repeatEl.textContent).toContain("±25%");

    expect(screen.getByTestId("total-samples").textContent).toBe("12");
    expect(screen.getByTestId("candidate-confirmed-count").textContent).toBe("10");
    expect(screen.getByTestId("externally-verified-count").textContent).toBe("2");
  });

  it("strictly distinguishes Candidate-Confirmed vs Externally-Verified outcomes", () => {
    const queryClient = createTestQueryClient();
    const mockEvents: OutcomeEvent[] = [
      {
        id: "evt-1",
        user_id: "usr-1",
        event_type: "offer",
        is_candidate_confirmed: true,
        is_externally_verified: true, // Gateway verified with proof receipt
        notes: "Offer letter signed with ATS webhook receipt",
        created_at: "2026-09-01T12:00:00Z",
      },
      {
        id: "evt-2",
        user_id: "usr-1",
        event_type: "interviewing",
        is_candidate_confirmed: true,
        is_externally_verified: false, // Candidate reported
        notes: "Onsite interview scheduled",
        created_at: "2026-09-02T14:00:00Z",
      },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <OutcomeTracker initialEvents={mockEvents} />
      </QueryClientProvider>
    );

    // Event 1 must show Externally Verified
    expect(screen.getAllByText("Externally Verified").length).toBeGreaterThanOrEqual(1);

    // Event 2 must show Candidate Confirmed
    expect(screen.getAllByText("Candidate Confirmed").length).toBeGreaterThanOrEqual(1);

    // Notes must be displayed
    expect(screen.getByText("Offer letter signed with ATS webhook receipt")).toBeInTheDocument();
    expect(screen.getByText("Onsite interview scheduled")).toBeInTheDocument();
  });
});
