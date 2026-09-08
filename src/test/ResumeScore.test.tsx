import "./setup";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResumeScore from "@/pages/ResumeScore";

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div data-testid="layout-wrapper">{children}</div>,
}));

vi.mock("@/components/seo/Seo", () => ({
  Seo: () => <div data-testid="seo-wrapper" />,
}));

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderResumeScore() {
  return render(
    <MemoryRouter initialEntries={["/resume-score"]}>
      <ResumeScore />
    </MemoryRouter>
  );
}

describe("ResumeScore Page", () => {
  it("renders page header, role benchmark presets, and input controls", () => {
    renderResumeScore();

    expect(screen.getByRole("heading", { level: 1, name: /How ATS-Friendly Is Your Resume\?/i })).toBeInTheDocument();
    expect(screen.getByText(/Target Role Benchmark/i)).toBeInTheDocument();

    // Benchmarks rendered
    expect(screen.getByText("Senior Full Stack Engineer")).toBeInTheDocument();
    expect(screen.getByText("Product Manager")).toBeInTheDocument();
    expect(screen.getByText("Distributed Systems Lead")).toBeInTheDocument();
    expect(screen.getByText("Senior AI / ML Engineer")).toBeInTheDocument();

    // Input fields & CTA button
    expect(screen.getByLabelText(/Resume text/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check My Resume Score Free/i })).toBeInTheDocument();
  });

  it("loads sample preset on click", async () => {
    renderResumeScore();

    const sampleButtons = screen.getAllByText(/Load Sample/i);
    expect(sampleButtons.length).toBeGreaterThan(0);

    fireEvent.click(sampleButtons[0]);

    const textarea = screen.getByLabelText(/Resume text/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("ALEX CHEN");
    expect(textarea.value).toContain("Senior Full Stack Engineer");
  });

  it("successfully performs an ATS scan and displays score gauge, breakdown, keywords, and weak bullet rewrites", async () => {
    const mockResponse = {
      overall_score: 88,
      score_breakdown: {
        skills_match: 92,
        experience_relevance: 85,
        formatting: 95,
        education_fit: 90,
      },
      matching_skills: ["React", "TypeScript", "Go", "PostgreSQL"],
      missing_skills: ["GraphQL", "Kafka"],
      result: {
        overall_score: 88,
        section_scores: {
          skills_match: 92,
          experience_relevance: 85,
          formatting: 95,
          education_fit: 90,
        },
        matched_keywords: ["React", "TypeScript", "Go", "PostgreSQL"],
        missing_keywords: ["GraphQL", "Kafka"],
        weak_bullets: [
          {
            original: "Worked on payments system and fixed bugs.",
            rewrite: "Architected fault-tolerant Go payments microservice processing $120M annualized volume with 99.99% uptime.",
          },
        ],
        summary: "Excellent candidate profile with strong architectural signals and quantifiable impact.",
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    renderResumeScore();

    fireEvent.change(screen.getByLabelText(/Resume text/i), {
      target: { value: "Alex Chen - Senior Full Stack Engineer with React, TypeScript, Go, and PostgreSQL experience." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Check My Resume Score Free/i }));

    expect(await screen.findByText("88")).toBeInTheDocument();
    expect(screen.getByText(/Strong ATS Ready Candidate/i)).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();

    // Keywords in Score Overview tab
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("GraphQL")).toBeInTheDocument();
    expect(screen.getByText("Kafka")).toBeInTheDocument();

    // Switch to Bullet Rewrites tab
    const rewritesTab = screen.getByRole("tab", { name: /Bullet Rewrites/i });
    fireEvent.mouseDown(rewritesTab, { button: 0 });
    expect(screen.getByText(/Weak Bullet Rewrite Suggestions/i)).toBeInTheDocument();
    expect(screen.getByText(/Worked on payments system and fixed bugs/i)).toBeInTheDocument();
    expect(screen.getByText(/Architected fault-tolerant Go payments microservice/i)).toBeInTheDocument();

    // Switch to ATS Parser Simulator tab
    const simulatorTab = screen.getByRole("tab", { name: /ATS Parser Simulator/i });
    fireEvent.mouseDown(simulatorTab, { button: 0 });
    expect(screen.getByText(/Enterprise Semantic Parser Simulation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Workday Parser/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Greenhouse Parser/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lever Plaintext Parser/i })).toBeInTheDocument();

    // Verify structured entities extracted
    expect(screen.getByText(/Candidate Identity & Contact Header/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Alex Chen/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Experience Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Normalized Skills Bag/i)).toBeInTheDocument();
    expect(screen.getByText(/ATS Parsing Hazard Flags/i)).toBeInTheDocument();

    // Toggle to Greenhouse Parser
    fireEvent.click(screen.getByRole("button", { name: /Greenhouse Parser/i }));
    expect(screen.getAllByText(/Greenhouse Automated Document Ingestion Pipeline/i).length).toBeGreaterThanOrEqual(1);

    // Toggle to Lever Plaintext Parser
    fireEvent.click(screen.getByRole("button", { name: /Lever Plaintext Parser/i }));
    expect(screen.getAllByText(/Lever Raw Plaintext Normalization Engine/i).length).toBeGreaterThanOrEqual(1);

    // Export button
    expect(screen.getByRole("button", { name: /Export Audit JSON/i })).toBeInTheDocument();

    // Pro CTA
    expect(screen.getByRole("link", { name: /Open Resume Studio/i })).toHaveAttribute("href", "/resume");
  });

  it("handles 429 rate limit error cleanly with alert banner", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limit exceeded" }),
    });

    renderResumeScore();

    fireEvent.change(screen.getByLabelText(/Resume text/i), {
      target: { value: "Alex Chen resume text for rate limit test." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Check My Resume Score Free/i }));

    expect(await screen.findByText(/Rate limit reached/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create Free Account/i })).toBeInTheDocument();
  });
});
