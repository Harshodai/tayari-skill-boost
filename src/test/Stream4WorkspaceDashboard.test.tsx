import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock AppShell layout to simplify test rendering
vi.mock("@/components/layout", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

// Mock AutomationContext
vi.mock("@/contexts/AutomationContext", () => ({
  useAutomation: () => ({
    startRun: vi.fn(),
    runChain: vi.fn(),
    open: vi.fn(),
    runs: [],
  }),
}));

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com", user_metadata: { full_name: "Alex Dev" } },
  }),
}));

// Mock api methods
vi.mock("@/api", () => ({
  listCareerOpsPortals: vi.fn().mockResolvedValue({ portals: [] }),
  createCareerOpsPortal: vi.fn().mockResolvedValue({ success: true }),
  deleteCareerOpsPortal: vi.fn().mockResolvedValue({ success: true }),
  updateCareerOpsPortal: vi.fn().mockResolvedValue({ success: true }),
  scanCareerOpsPortals: vi.fn().mockResolvedValue({ jobs: [] }),
  getCareerOpsPatterns: vi.fn().mockResolvedValue({ total_analyzed: 10, outcomes: { positive: 4 }, score_averages: { positive: 4.2 } }),
  listCareerOpsFollowups: vi.fn().mockResolvedValue({ followups: [] }),
  actionCareerOpsFollowup: vi.fn().mockResolvedValue({ success: true }),
  getCareerOpsStoryBank: vi.fn().mockResolvedValue({ stories: [] }),
  saveCareerOpsStoryBank: vi.fn().mockResolvedValue({ success: true }),
  deleteCareerOpsStoryBank: vi.fn().mockResolvedValue({ success: true }),
  getCareerOpsStats: vi.fn().mockResolvedValue({ total_portals: 5, total_jobs_found: 24, total_applications: 12, active_scans: 2 }),
  listApplications: vi.fn().mockResolvedValue([]),
  createApplication: vi.fn().mockResolvedValue({ success: true }),
  updateApplication: vi.fn().mockResolvedValue({ success: true }),
  deleteApplication: vi.fn().mockResolvedValue({ success: true }),
  addApplicationNote: vi.fn().mockResolvedValue({ success: true }),
  deleteApplicationNote: vi.fn().mockResolvedValue({ success: true }),
  getApplicationInterviewQuestions: vi.fn().mockResolvedValue({}),
  parseApplicationEmail: vi.fn().mockResolvedValue({}),
  uploadApplicationVoice: vi.fn().mockResolvedValue({}),
  getGmailStatus: vi.fn().mockResolvedValue({ enabled: false, connected: false }),
  getGmailLogin: vi.fn().mockResolvedValue({}),
  syncGmail: vi.fn().mockResolvedValue({}),
  disconnectGmail: vi.fn().mockResolvedValue({}),
  optimizeResume: vi.fn().mockResolvedValue({}),
  deepATS: vi.fn().mockResolvedValue({}),
  exportResume: vi.fn().mockResolvedValue(new Blob([])),
  listAnalysisHistory: vi.fn().mockResolvedValue([]),
  getFunnelData: vi.fn().mockResolvedValue({ saved: 0, applied: 0, interview: 0, offer: 0 }),
}));

// Mock hooks
vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardData: () => ({
    analyses: [{ overall_score: 82, job_title: "Senior Engineer" }],
    savedJobs: [],
    roadmap: [{ id: "1", step_key: "Learn Go", status: "completed" }],
    interviews: [],
    funnel: { saved: 3, applied: 5, interview: 2, offer: 1 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBackendHealth", () => ({
  useBackendHealth: () => ({
    unavailable: false,
  }),
}));

import CareerOpsDashboard from "@/pages/CareerOpsDashboard";
import Dashboard from "@/pages/Dashboard";
import ResumeResults from "@/pages/ResumeResults";
import InterviewBoard from "@/pages/InterviewBoard";

function renderWithProviders(element: ReactNode, initialEntries = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {element}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Stream 4: Workspace & Dashboard Implementation Tests", () => {
  describe("CareerOpsDashboard", () => {
    it("renders wrapped inside AppShell with breadcrumb page header", async () => {
      renderWithProviders(<CareerOpsDashboard />);

      expect(screen.getByTestId("app-shell")).toBeInTheDocument();
      expect(screen.getByText("Career-Ops Command Center")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Career-Ops")).toBeInTheDocument();
      expect(screen.getByText("Scan Portals")).toBeInTheDocument();
    });

    it("displays structured empty states instead of bare unstyled text", async () => {
      renderWithProviders(<CareerOpsDashboard />);

      expect(screen.getByText("No scanner portals configured")).toBeInTheDocument();
      expect(screen.getByText(/Add a company careers URL below to start scanning/i)).toBeInTheDocument();
    });
  });

  describe("Dashboard", () => {
    it("renders streamlined 8-tool Jobseeker AI Command Center without dark clutter", () => {
      renderWithProviders(<Dashboard />);

      expect(screen.getByText("Jobseeker AI Command Center")).toBeInTheDocument();
      expect(screen.getByText("Workspace tools")).toBeInTheDocument();
      expect(screen.queryByText("8 Tools Active")).not.toBeInTheDocument();
      expect(screen.queryByText("vs last week")).not.toBeInTheDocument();
      expect(screen.getByText("Company Radar")).toBeInTheDocument();
      expect(screen.getByText("Voice Coach")).toBeInTheDocument();
      expect(screen.getByText("Salary Negotiation")).toBeInTheDocument();
      expect(screen.getByText("Skill Gap Radar")).toBeInTheDocument();
      expect(screen.getByText("Portfolio Builder")).toBeInTheDocument();
      expect(screen.getByText("Recruiter Outreach")).toBeInTheDocument();
      expect(screen.getByText("Funnel Analytics")).toBeInTheDocument();
      expect(screen.getByText("Cover Letter AI")).toBeInTheDocument();
    });

    it("renders clean One-Shot Autopilot banner and stats card tabular numbers", () => {
      renderWithProviders(<Dashboard />);

      expect(screen.getByText("One-Shot Autopilot Console")).toBeInTheDocument();
      expect(screen.getByText(/Launch One-Shot Console/i)).toBeInTheDocument();
      expect(screen.getByText("Resume Score")).toBeInTheDocument();
      expect(screen.getByText("Saved Jobs")).toBeInTheDocument();
    });
  });

  describe("ResumeResults", () => {
    const mockAnalysisResults = {
      overallScore: 85,
      matchedKeywords: ["React", "TypeScript", "Tailwind CSS"],
      missingKeywords: ["GraphQL"],
      summaryRecommendation: "Focus on highlighting system architecture experience.",
      sections: [
        {
          name: "Skills Match",
          score: 90,
          suggestions: ["Add more cloud deployment examples"],
        },
        {
          name: "Experience Relevance",
          score: 80,
          suggestions: ["Quantify latency reductions"],
        },
      ],
    };

    it("renders consolidated toolbar with Choose Template primary CTA, Optimize secondary CTA, and dropdown", () => {
      renderWithProviders(
        <Routes>
          <Route path="/resume/results" element={<ResumeResults />} />
        </Routes>,
        [{ pathname: "/resume/results", state: { analysisResults: mockAnalysisResults, resumeId: 1, resumeFileName: "my_resume.pdf" } }]
      );

      expect(screen.getByRole("button", { name: /Choose Template/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Optimize/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /More actions/i })).toBeInTheDocument();
      expect(screen.getByText("Overall Match Score")).toBeInTheDocument();
    });
  });

  describe("InterviewBoard", () => {
    it("renders dashed drop targets with helpful hints for empty Kanban columns", async () => {
      renderWithProviders(<InterviewBoard />);

      const emptyTargets = await screen.findAllByText("No active interviews in this stage");
      expect(emptyTargets.length).toBeGreaterThan(0);
      expect(screen.getByText("Add or import positions to track them here")).toBeInTheDocument();
    });
  });
});
