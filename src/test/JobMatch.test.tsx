import "./setup";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import JobMatch from "@/pages/JobMatch";

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

function renderJobMatch() {
  return render(
    <MemoryRouter initialEntries={["/job-match"]}>
      <JobMatch />
    </MemoryRouter>
  );
}

describe("JobMatch Page", () => {
  it("renders side-by-side inputs, presets, and calculate CTA", () => {
    renderJobMatch();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Does Your Resume/i);
    expect(heading).toHaveTextContent(/Match This Job/i);
    expect(screen.getByLabelText(/Your Resume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Job Description/i)).toBeInTheDocument();

    // Presets
    expect(screen.getByText(/Frontend Engineer \(Stripe\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Distributed Systems Lead \(Cloudflare\)/i)).toBeInTheDocument();

    // CTA
    expect(screen.getByRole("button", { name: /Calculate Match Rate Free/i })).toBeInTheDocument();
  });

  it("loads sample match preset into both panes upon selection", () => {
    renderJobMatch();

    const stripePreset = screen.getByRole("button", { name: /Frontend Engineer \(Stripe\)/i });
    fireEvent.click(stripePreset);

    const resumeInput = screen.getByLabelText(/Your Resume/i) as HTMLTextAreaElement;
    const jdInput = screen.getByLabelText(/Target Job Description/i) as HTMLTextAreaElement;

    expect(resumeInput.value).toContain("SENIOR FRONTEND ENGINEER");
    expect(jdInput.value).toContain("Role: Senior Frontend Engineer");
    expect(jdInput.value).toContain("Stripe");
  });

  it("calculates match rate and displays percentage gauge, matched/missing keywords, and overlap breakdown", async () => {
    const mockResponse = {
      overall_score: 84,
      score_breakdown: {
        skills_match: 88,
        experience_relevance: 82,
        formatting: 90,
        education_fit: 85,
      },
      matching_skills: ["React", "TypeScript", "Vite", "Playwright"],
      missing_skills: ["GraphQL", "WebSockets"],
      recommendations: ["Add concrete metrics demonstrating GraphQL or WebSocket data streaming."],
      result: {
        overall_score: 84,
        section_scores: {
          skills_match: 88,
          experience_relevance: 82,
          formatting: 90,
          education_fit: 85,
        },
        matched_keywords: ["React", "TypeScript", "Vite", "Playwright"],
        missing_keywords: ["GraphQL", "WebSockets"],
        recommendations: ["Add concrete metrics demonstrating GraphQL or WebSocket data streaming."],
        summary: "Strong role alignment with modern frontend requirements.",
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    renderJobMatch();

    fireEvent.change(screen.getByLabelText(/Your Resume/i), {
      target: { value: "Frontend Engineer with React, TypeScript, and Playwright experience." },
    });
    fireEvent.change(screen.getByLabelText(/Target Job Description/i), {
      target: { value: "Senior Frontend Engineer with React, TypeScript, GraphQL, and WebSockets." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Calculate Match Rate Free/i }));

    expect(await screen.findByText("84%")).toBeInTheDocument();
    expect(screen.getByText(/Strong Role Match — Interview Ready/i)).toBeInTheDocument();

    // Overlap scores
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();

    // Keywords
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("GraphQL")).toBeInTheDocument();
    expect(screen.getByText("WebSockets")).toBeInTheDocument();

    // Recommendations
    expect(screen.getByText(/Add concrete metrics demonstrating GraphQL or WebSocket data streaming/i)).toBeInTheDocument();

    // Export button
    expect(screen.getByRole("button", { name: /Export Match JSON/i })).toBeInTheDocument();

    // Tailor Resume Link
    expect(screen.getByRole("link", { name: /Tailor Resume in Studio/i })).toHaveAttribute("href", "/resume");
  });

  it("handles 429 rate limit error gracefully with alert banner", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limit reached" }),
    });

    renderJobMatch();

    fireEvent.change(screen.getByLabelText(/Your Resume/i), {
      target: { value: "Sample resume text." },
    });
    fireEvent.change(screen.getByLabelText(/Target Job Description/i), {
      target: { value: "Sample job description." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Calculate Match Rate Free/i }));

    expect(await screen.findByText(/Rate limit reached/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create Free Account/i })).toBeInTheDocument();
  });
});
