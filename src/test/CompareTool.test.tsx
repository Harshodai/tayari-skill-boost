import "./setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  COMPARISONS_DATA,
  getAllComparisons,
  getComparisonBySlug,
} from "@/data/comparisonsData";
import { CompareTool } from "@/pages/CompareTool";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-wrapper">{children}</div>,
}));

vi.mock("@/components/seo/Seo", () => ({
  Seo: () => <div data-testid="seo-wrapper" />,
}));

describe("Competitor Comparison Engine - Data Layer (comparisonsData.ts)", () => {
  it("includes comprehensive comparison datasets for Jobscan, Teal, Simplify, and Rezi", () => {
    const comparisons = getAllComparisons();
    expect(comparisons.length).toBeGreaterThanOrEqual(4);

    const slugs = comparisons.map((c) => c.slug);
    expect(slugs).toContain("jobscan");
    expect(slugs).toContain("teal");
    expect(slugs).toContain("simplify");
    expect(slugs).toContain("rezi");
  });

  it("articulates simulated ATS parsing moat against Jobscan", () => {
    const jobscan = getComparisonBySlug("jobscan");
    expect(jobscan).toBeDefined();
    expect(jobscan!.title).toContain("Jobscan");
    expect(jobscan!.title).toContain("Real ATS Parsing");
    expect(jobscan!.competitorPricing).toContain("49.95");
    expect(jobscan!.oursPricing).toContain("$12/mo");

    const atsFeature = jobscan!.matrix.find((f) => f.name.includes("Workday"));
    expect(atsFeature).toBeDefined();
    expect(atsFeature!.ours.supported).toBe(true);
    expect(atsFeature!.competitor.supported).toBe(false);
  });

  it("articulates fast time-to-value and keyless Hermes scraping against Teal", () => {
    const teal = getComparisonBySlug("teal");
    expect(teal).toBeDefined();
    expect(teal!.title).toContain("Teal");
    expect(teal!.title).toContain("CRM");

    const ttvFeature = teal!.matrix.find((f) => f.name.includes("Time to First"));
    expect(ttvFeature).toBeDefined();
    expect(ttvFeature!.ours.label).toBe("< 60 Seconds");
  });

  it("articulates candidate fit and truthfulness against Simplify", () => {
    const simplify = getComparisonBySlug("simplify");
    expect(simplify).toBeDefined();
    expect(simplify!.title).toContain("Simplify");
    expect(simplify!.title).toContain("Speed vs. Strategy");

    const receiptFeature = simplify!.matrix.find((f) => f.name.includes("Submission Proof"));
    expect(receiptFeature).toBeDefined();
    expect(receiptFeature!.ours.supported).toBe(true);
    expect(receiptFeature!.ours.detail).toContain("SHA-256");
  });

  it("articulates live simulation and roadmaps against Rezi", () => {
    const rezi = getComparisonBySlug("rezi");
    expect(rezi).toBeDefined();
    expect(rezi!.title).toContain("Rezi");

    const roadmapFeature = rezi!.matrix.find((f) => f.name.includes("Roadmap"));
    expect(roadmapFeature).toBeDefined();
    expect(roadmapFeature!.ours.supported).toBe(true);
  });
});

describe("CompareTool Component - Directory View (/compare)", () => {
  it("renders comparison directory cards for all 4 competitors", () => {
    render(
      <MemoryRouter initialEntries={["/compare"]}>
        <Routes>
          <Route path="/compare" element={<CompareTool />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/How Job Tayari Compares to Other AI Career Platforms/i)).toBeInTheDocument();
    expect(screen.getByText(/Independent Platform Analysis/i)).toBeInTheDocument();

    // Check competitor cards
    expect(screen.getAllByText(/vs\. Jobscan/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/vs\. Teal/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/vs\. Simplify/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/vs\. Rezi/i).length).toBeGreaterThanOrEqual(1);

    // CTAs
    expect(screen.getByRole("button", { name: /Read Full Jobscan Comparison/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Read Full Teal Comparison/i })).toBeInTheDocument();
  });
});

describe("CompareTool Component - Specific Tool View (/compare/:tool)", () => {
  it("renders Jobscan comparison matrix and navigates to free-scan", () => {
    render(
      <MemoryRouter initialEntries={["/compare/jobscan"]}>
        <Routes>
          <Route path="/compare/:tool" element={<CompareTool />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /Job Tayari vs\. Jobscan/i })).toBeInTheDocument();
    expect(screen.getByText(/The Bottom Line Verdict/i)).toBeInTheDocument();
    expect(screen.getByText(/Detailed Capability Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Frequently Asked Questions/i)).toBeInTheDocument();

    // Free Scan CTA
    const freeScanCta = screen.getByRole("button", { name: /Try 60-Second ATS Scan Free/i });
    expect(freeScanCta).toBeInTheDocument();
    fireEvent.click(freeScanCta);
    expect(mockNavigate).toHaveBeenCalledWith("/free-scan");
  });

  it("renders Teal comparison detail view with pricing and switchers", () => {
    render(
      <MemoryRouter initialEntries={["/compare/teal"]}>
        <Routes>
          <Route path="/compare/:tool" element={<CompareTool />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /Job Tayari vs\. Teal/i })).toBeInTheDocument();
    expect(screen.getByText(/Job Search & CRM Comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/vs\. Jobscan/i)).toBeInTheDocument();
    expect(screen.getByText(/vs\. Simplify/i)).toBeInTheDocument();
  });
});
