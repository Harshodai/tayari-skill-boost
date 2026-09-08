import "./setup";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RoleLanding from "@/pages/RoleLanding";
import { toast } from "sonner";

let capturedSeoProps: any = null;

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div data-testid="layout-wrapper">{children}</div>,
}));

vi.mock("@/components/seo/Seo", () => ({
  Seo: (props: any) => {
    capturedSeoProps = props;
    return <div data-testid="seo-wrapper" data-title={props.title} />;
  },
  SITE_URL: "https://tayari-skill-boost.lovable.app",
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  capturedSeoProps = null;
  vi.clearAllMocks();

  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    writable: true,
    configurable: true,
  });

  window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  window.URL.revokeObjectURL = vi.fn();
});

function renderRoleLanding(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/roles" element={<RoleLanding />} />
        <Route path="/roles/:slug" element={<RoleLanding />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RoleLanding Component", () => {
  describe("Directory View (/roles)", () => {
    it("renders the directory header, search input, and role cards", () => {
      renderRoleLanding("/roles");

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Role-Specific ATS Benchmarks/i);
      expect(screen.getByPlaceholderText(/Search roles or skills/i)).toBeInTheDocument();

      // Check all 6 high-demand roles are displayed
      expect(screen.getByText("Software Engineer")).toBeInTheDocument();
      expect(screen.getByText("Product Manager")).toBeInTheDocument();
      expect(screen.getByText("Data Scientist")).toBeInTheDocument();
      expect(screen.getByText("DevOps Engineer")).toBeInTheDocument();
      expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
      expect(screen.getByText("Cloud Architect")).toBeInTheDocument();

      // Check benchmark and salary badges
      expect(screen.getAllByText(/Target ATS:/i).length).toBeGreaterThanOrEqual(6);
      expect(screen.getByText("$125,000 - $210,000")).toBeInTheDocument();

      // Verify CollectionPage SEO metadata
      expect(capturedSeoProps).not.toBeNull();
      expect(capturedSeoProps.title).toContain("Tech Role ATS Benchmarks");
      expect(capturedSeoProps.path).toBe("/roles");
      expect(capturedSeoProps.jsonLd["@type"]).toBe("CollectionPage");
    });

    it("filters roles interactively based on search input", () => {
      renderRoleLanding("/roles");

      const searchInput = screen.getByPlaceholderText(/Search roles or skills/i);
      fireEvent.change(searchInput, { target: { value: "Frontend" } });

      expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
      expect(screen.queryByText("Cloud Architect")).not.toBeInTheDocument();
      expect(screen.queryByText("Product Manager")).not.toBeInTheDocument();
    });

    it("displays an empty state when search matches no roles", () => {
      renderRoleLanding("/roles");

      const searchInput = screen.getByPlaceholderText(/Search roles or skills/i);
      fireEvent.change(searchInput, { target: { value: "NonExistentRole123" } });

      expect(screen.getByText(/No roles matched your search/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reset Search/i })).toBeInTheDocument();
    });
  });

  describe("Role Detail View (/roles/:slug)", () => {
    it("renders role details, benchmarks, top skills, PAR bullets, and FAQs for software-engineer", () => {
      renderRoleLanding("/roles/software-engineer");

      // Title & Overview
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Software Engineer Resume & ATS Guide/i);
      expect(screen.getByText(/Full Stack & Backend Distributed Systems Engineering/i)).toBeInTheDocument();

      // Benchmarks Scorecard
      expect(screen.getByText("85%")).toBeInTheDocument(); // Passing ATS Score
      expect(screen.getByText("14% - 18%")).toBeInTheDocument(); // Keyword Density
      expect(screen.getByText("80%+")).toBeInTheDocument(); // Metric-backed bullets

      // Top 10 Skills
      expect(screen.getByText("Distributed Systems & Microservices")).toBeInTheDocument();
      expect(screen.getByText("TypeScript / Node.js or Go")).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL & Database Indexing")).toBeInTheDocument();
      expect(screen.getByText("94% of JDs")).toBeInTheDocument();

      // PAR Bullet Rewrites
      expect(screen.getByText(/Microservices Scalability & p99 Latency/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Optimized PAR Bullet/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Architected asynchronous Go payments microservice/i)).toBeInTheDocument();

      // Common Rejection Traps
      expect(screen.getByText(/Vague responsibilities without quantifiable business impact/i)).toBeInTheDocument();

      // FAQs
      expect(screen.getByText(/What ATS score is required to pass initial screening for Software Engineers\?/i)).toBeInTheDocument();

      // Schema.org Occupation & FAQPage JSON-LD
      expect(capturedSeoProps).not.toBeNull();
      expect(capturedSeoProps.title).toContain("Software Engineer");
      expect(capturedSeoProps.path).toBe("/roles/software-engineer");
      expect(Array.isArray(capturedSeoProps.jsonLd)).toBe(true);

      const occupation = capturedSeoProps.jsonLd.find((item: any) => item["@type"] === "Occupation");
      expect(occupation).toBeDefined();
      expect(occupation.name).toBe("Software Engineer");
      expect(occupation.estimatedSalary[0].currency).toBe("USD");

      const faq = capturedSeoProps.jsonLd.find((item: any) => item["@type"] === "FAQPage");
      expect(faq).toBeDefined();
      expect(faq.mainEntity.length).toBeGreaterThanOrEqual(1);
    });

    it("has a 1-click CTA button pointing to /resume with prefilled role slug", () => {
      renderRoleLanding("/roles/software-engineer");

      const tailorCta = screen.getAllByRole("link", { name: /Tailor Resume for Software Engineer/i })[0];
      expect(tailorCta).toHaveAttribute("href", "/resume?role=software-engineer");

      const bottomCta = screen.getByRole("link", { name: /Open in Resume Studio/i });
      expect(bottomCta).toHaveAttribute("href", "/resume?role=software-engineer");
    });

    it("allows copying the sample ATS resume template to clipboard", async () => {
      renderRoleLanding("/roles/software-engineer");

      const copyBtn = screen.getAllByRole("button", { name: /Copy Sample Template/i })[0];
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("copied to clipboard"));
      });
    });

    it("allows downloading the role benchmark JSON file", () => {
      renderRoleLanding("/roles/software-engineer");

      const downloadBtn = screen.getByRole("button", { name: /Download Benchmark JSON/i });
      fireEvent.click(downloadBtn);

      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("software-engineer-ats-benchmark.json"));
    });

    it("allows checking items in the interactive ATS checklist", () => {
      renderRoleLanding("/roles/software-engineer");

      expect(screen.getByText("0 of 7 Completed")).toBeInTheDocument();

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);

      expect(screen.getByText("1 of 7 Completed")).toBeInTheDocument();
    });

    it("renders a 404 fallback message when an invalid role slug is requested", () => {
      renderRoleLanding("/roles/unknown-role-slug");

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Role Guide Not Found/i);
      expect(screen.getByText(/Browse All Roles/i)).toBeInTheDocument();
      expect(capturedSeoProps.noindex).toBe(true);
    });
  });
});
