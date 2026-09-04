import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { DecisionQueue } from "@/components/DecisionQueue";
import * as api from "@/api";
import type { CareerAction } from "@/api/types";

vi.mock("@/api", () => ({
  getCareerNextActions: vi.fn(),
}));

describe("DecisionQueue Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockActions: CareerAction[] = [
    {
      action_id: "act-1",
      type: "approval",
      title: "Review pending application submission (Application)",
      why_now: "Human-in-the-loop review is mandatory before submission boundary.",
      effort_estimate_mins: 3,
      confidence: 0.98,
      status_badge: "verified",
      freshness_ts: "2026-09-03T10:00:00Z",
      required_action_by_candidate: "Review application payload and confirm submission",
      evidence_url: "/career-ops",
    },
    {
      action_id: "act-2",
      type: "followup",
      title: "Follow up on application at Acme Corp (Backend Lead)",
      why_now: "Timely recruiter follow-ups sent within 5-7 days double response rates.",
      effort_estimate_mins: 5,
      confidence: 0.92,
      status_badge: "candidate_confirmed",
      freshness_ts: "2026-09-03T10:00:00Z",
      required_action_by_candidate: "Review AI-generated follow-up note and send via email",
      evidence_url: "/career-ops?tab=followup",
    },
    {
      action_id: "act-3",
      type: "resume_optimization",
      title: "Tailor 'Current Resume' for upcoming applications",
      why_now: "Role-specific tailoring lifts ATS semantic fit by over 50%.",
      effort_estimate_mins: 10,
      confidence: 0.88,
      status_badge: "inferred",
      freshness_ts: "2026-09-03T10:00:00Z",
      required_action_by_candidate: "Optimize resume against target job description",
      evidence_url: "/resume/results?resumeId=101",
    },
  ];

  it("renders loading state initially", () => {
    vi.mocked(api.getCareerNextActions).mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <BrowserRouter>
        <DecisionQueue />
      </BrowserRouter>
    );

    expect(screen.getByTestId("decision-queue-loading")).toBeInTheDocument();
    expect(screen.getByText(/Evaluating career actions and ranking priorities/i)).toBeInTheDocument();
  });

  it("renders truthful empty state when no actions are returned", async () => {
    vi.mocked(api.getCareerNextActions).mockResolvedValue({ actions: [] });

    render(
      <BrowserRouter>
        <DecisionQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("decision-queue-empty")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Add or optimize your resume to generate personalized career actions/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Upload or Optimize Resume/i })).toBeInTheDocument();
  });

  it("renders ranked decision queue with status badges, why now, and effort pills", async () => {
    vi.mocked(api.getCareerNextActions).mockResolvedValue({ actions: mockActions });

    render(
      <BrowserRouter>
        <DecisionQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("decision-queue-list")).toBeInTheDocument();
    });

    // Check titles
    expect(screen.getByText(/Review pending application submission/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow up on application at Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByText(/Tailor 'Current Resume' for upcoming applications/i)).toBeInTheDocument();

    // Check status badges
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Candidate Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();

    // Check effort pills
    expect(screen.getByText(/3 mins/i)).toBeInTheDocument();
    expect(screen.getByText(/5 mins/i)).toBeInTheDocument();
    expect(screen.getByText(/10 mins/i)).toBeInTheDocument();

    // Check why now reasoning
    expect(screen.getByText(/Human-in-the-loop review is mandatory before submission boundary/i)).toBeInTheDocument();
    expect(screen.getByText(/Timely recruiter follow-ups sent within 5-7 days double response rates/i)).toBeInTheDocument();

    // Check action buttons
    const actButtons = screen.getAllByRole("link", { name: /Act Now/i });
    expect(actButtons.length).toBe(3);
    expect(actButtons[0]).toHaveAttribute("href", "/career-ops");
  });

  it("renders error banner when API call fails", async () => {
    vi.mocked(api.getCareerNextActions).mockRejectedValue(new Error("Network connection refused"));

    render(
      <BrowserRouter>
        <DecisionQueue />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("decision-queue-error")).toBeInTheDocument();
    });

    expect(screen.getByText(/Unable to load decision queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Network connection refused/i)).toBeInTheDocument();
  });
});
