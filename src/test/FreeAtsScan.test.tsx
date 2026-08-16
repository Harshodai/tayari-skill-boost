import "./setup";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FreeAtsScan from "@/pages/FreeAtsScan";

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div data-testid="layout-wrapper">{children}</div>,
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

function renderFreeAtsScan() {
  return render(
    <MemoryRouter initialEntries={["/free-scan"]}>
      <FreeAtsScan />
    </MemoryRouter>
  );
}

describe("FreeAtsScan Page", () => {
  it("renders page inputs, guidance, and primary scan action", () => {
    renderFreeAtsScan();

    expect(screen.getByText(/Free/i)).toBeInTheDocument();
    expect(screen.getByText(/ATS Resume Scan/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Your Resume")).toBeInTheDocument();
    expect(screen.getByLabelText("Job Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scan My Resume/i })).toBeEnabled();
    expect(screen.getByText(/Paste only the text needed for this scan; do not include secrets/i)).toBeInTheDocument();
  });

  it("shows validation error if inputs are empty upon scanning", async () => {
    renderFreeAtsScan();

    fireEvent.click(screen.getByRole("button", { name: /Scan My Resume/i }));

    expect(await screen.findByText(/Please fill in both fields before scanning/i)).toBeInTheDocument();
  });

  it("successfully performs an ATS scan and renders results and onboarding funnel", async () => {
    const mockScanResponse = {
      overall_score: 85,
      score_breakdown: {
        skills_match: 90,
        experience_relevance: 80,
      },
      matching_skills: ["TypeScript", "React", "Go"],
      missing_skills: ["Kubernetes", "AWS"],
      recommendations: ["Highlight distributed systems experience in your summary."],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockScanResponse,
    });

    renderFreeAtsScan();

    fireEvent.change(screen.getByLabelText("Your Resume"), {
      target: { value: "Experienced Software Engineer with TypeScript and React background." },
    });
    fireEvent.change(screen.getByLabelText("Job Description"), {
      target: { value: "Looking for Senior Frontend Engineer with TypeScript, React, and Go." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Scan My Resume/i }));

    expect(await screen.findByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Strong match! Your resume is well-aligned with this role.")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Highlight distributed systems experience in your summary.")).toBeInTheDocument();

    // Verify candidate onboarding funnel links
    const createAccountLink = screen.getByRole("link", { name: /Create Free Account/i });
    expect(createAccountLink).toHaveAttribute("href", "/auth?redirect=/pricing");

    const seePricingLink = screen.getByRole("link", { name: /See Pricing/i });
    expect(seePricingLink).toHaveAttribute("href", "/pricing");
  });

  it("handles 429 rate limit response gracefully with a call to create an account", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many requests" }),
    });

    renderFreeAtsScan();

    fireEvent.change(screen.getByLabelText("Your Resume"), {
      target: { value: "Full Stack Engineer" },
    });
    fireEvent.change(screen.getByLabelText("Job Description"), {
      target: { value: "Senior Backend Developer" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Scan My Resume/i }));

    expect(
      await screen.findByText(/Rate limit reached\. Please wait a moment before trying again, or create a free account for higher limits\./i)
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Create Free Account/i })).toHaveAttribute(
      "href",
      "/auth?redirect=/pricing"
    );
  });

  it("handles 400/422 invalid input errors with retry button", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: "Unprocessable entity" }),
    });

    renderFreeAtsScan();

    fireEvent.change(screen.getByLabelText("Your Resume"), {
      target: { value: "Short resume" },
    });
    fireEvent.change(screen.getByLabelText("Job Description"), {
      target: { value: "Short JD" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Scan My Resume/i }));

    expect(
      await screen.findByText(/Invalid input\. Please check your resume and job description text and try again\./i)
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});
