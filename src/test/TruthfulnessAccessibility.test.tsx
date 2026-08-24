import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CTASection } from "@/components/landing/CTASection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { GhostJobStat } from "@/components/landing/GhostJobStat";
import { ReceiptShowcase } from "@/components/landing/ReceiptShowcase";
import FreeAtsScan from "@/pages/FreeAtsScan";
import Privacy from "@/pages/Privacy";

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("truthfulness and accessibility release contracts", () => {
  it("labels the receipt card as illustrative rather than a live submission", () => {
    render(<ReceiptShowcase />);
    expect(screen.getByText(/Illustrative UI example — no application was submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/When a supported workflow receives an external confirmation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Every submission produces an immutable receipt/i)).not.toBeInTheDocument();
  });

  it("labels the AutoPilot animation as review-only and non-submitting", () => {
    renderWithRouter(<FeaturesSection />);
    expect(screen.getByText(/Illustrative workflow · no application submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/Preparing Submission for Review/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Submitting Application$/i)).not.toBeInTheDocument();
  });

  it("labels the ghost-job benchmark as synthetic and non-predictive", () => {
    render(<GhostJobStat />);
    expect(screen.getAllByText(/synthetic fixture v2/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not a production accuracy claim/i)).toBeInTheDocument();
    expect(screen.queryByText(/87% of ghost postings caught/i)).not.toBeInTheDocument();
  });

  it("removes unsupported user-count and hiring guarantees from conversion copy", () => {
    renderWithRouter(<CTASection />);
    expect(screen.getByText(/build a career-search rhythm around context, preparation, review, and learning/i)).toBeInTheDocument();
    expect(screen.queryByText(/Join thousands of engineers/i)).not.toBeInTheDocument();
  });

  it("exposes labeled inputs and public conversion states", () => {
    renderWithRouter(<FreeAtsScan />);
    expect(screen.getByLabelText("Your Resume")).toBeInTheDocument();
    expect(screen.getByLabelText("Job Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review my resume/i })).toBeEnabled();
  });

  it("renders privacy retention controls without absolute local-only guarantees", () => {
    renderWithRouter(<Privacy />);
    expect(screen.getByText("Retention and deletion")).toBeInTheDocument();
    expect(screen.getByText(/Tayari does not claim that every provider has identical/i)).toBeInTheDocument();
    expect(screen.queryByText("100% Local Self-Hosting Support")).not.toBeInTheDocument();
  });
});
