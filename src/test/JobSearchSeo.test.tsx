import "./setup";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JobSearch from "@/pages/JobSearch";

const capturedSeoProps: any[] = [];

vi.mock("@/components/seo/Seo", () => ({
  Seo: (props: any) => {
    capturedSeoProps.push(props);
    return <div data-testid="mock-seo" data-title={props.title} data-jsonld={JSON.stringify(props.jsonLd)} />;
  },
}));

vi.mock("@/components/layout", () => ({
  AppShell: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com" },
  }),
}));

vi.mock("@/contexts/AutomationContext", () => ({
  useAutomation: () => ({
    startRun: vi.fn(),
    runChain: vi.fn(),
    open: vi.fn(),
    runs: [],
  }),
}));

vi.mock("@/hooks/useBackendHealth", () => ({
  useBackendHealth: () => ({
    unavailable: false,
    refetch: vi.fn(),
  }),
}));

const mockJobs = [
  {
    title: "Senior Staff Distributed Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    description: "Build ultra-low latency distributed payment ledger handling billions in volume.",
    snippet: "Build ultra-low latency distributed payment ledger.",
    employment_type: "FULL_TIME",
    job_type: "Full-time",
    posted_at: "2026-09-01T12:00:00.000Z",
    url: "https://stripe.com/jobs/123",
    score: 94,
    match_score: 94,
    ats_provider: "greenhouse",
    matched_skills: ["Go", "Distributed Systems", "PostgreSQL"],
    missing_skills: ["Rust"],
  },
];

vi.mock("@/api", () => ({
  searchJobs: vi.fn().mockResolvedValue({
    total_found: 1,
    jobs: [
      {
        title: "Senior Staff Distributed Engineer",
        company: "Stripe",
        location: "San Francisco, CA",
        description: "Build ultra-low latency distributed payment ledger handling billions in volume.",
        snippet: "Build ultra-low latency distributed payment ledger.",
        employment_type: "FULL_TIME",
        job_type: "Full-time",
        posted_at: "2026-09-01T12:00:00.000Z",
        url: "https://stripe.com/jobs/123",
        score: 94,
        match_score: 94,
        ats_provider: "greenhouse",
        matched_skills: ["Go", "Distributed Systems", "PostgreSQL"],
        missing_skills: ["Rust"],
      },
    ],
  }),
  agentSearch: vi.fn().mockResolvedValue({ results: [] }),
  saveJob: vi.fn().mockResolvedValue({ success: true }),
  listSavedJobs: vi.fn().mockResolvedValue([]),
  getProfile: vi.fn().mockResolvedValue({ profile: {} }),
  listResumes: vi.fn().mockResolvedValue({ resumes: [] }),
  isBackendUnavailable: vi.fn().mockReturnValue(false),
}));

beforeEach(() => {
  capturedSeoProps.length = 0;
});

describe("JobSearch Schema.org JobPosting Integration", () => {
  it("renders Seo component with valid Schema.org JobPosting JSON-LD when job is selected", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <QueryClientProvider client={queryClient}>
          <JobSearch />
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Verify initial SEO tags rendered
    expect(screen.getByTestId("mock-seo")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Try "Remote senior PM/i);
    fireEvent.change(searchInput, { target: { value: "Distributed" } });
    fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      const seoWithJob = capturedSeoProps.find((p) => p.jsonLd && p.jsonLd["@type"] === "JobPosting");
      expect(seoWithJob).toBeDefined();
      expect(seoWithJob.path).toBe("/jobs");
      expect(seoWithJob.jsonLd["@context"]).toBe("https://schema.org");
      expect(seoWithJob.jsonLd["@type"]).toBe("JobPosting");
      expect(seoWithJob.jsonLd.title).toBe("Senior Staff Distributed Engineer");
      expect(seoWithJob.jsonLd.description).toBe("Build ultra-low latency distributed payment ledger handling billions in volume.");
      expect(seoWithJob.jsonLd.hiringOrganization).toEqual({
        "@type": "Organization",
        name: "Stripe",
      });
      expect(seoWithJob.jsonLd.jobLocation).toEqual({
        "@type": "Place",
        address: "San Francisco, CA",
      });
      expect(seoWithJob.jsonLd.employmentType).toBe("FULL_TIME");
      expect(seoWithJob.jsonLd.datePosted).toBe("2026-09-01T12:00:00.000Z");
      expect(seoWithJob.jsonLd.directApply).toBe(true);
    });
  });
});
