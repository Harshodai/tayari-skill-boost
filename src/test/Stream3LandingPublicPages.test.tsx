import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div data-testid="layout-wrapper">{children}</div>,
}));

import About from "@/pages/About";
import LandingPage from "@/pages/Landing";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ProductsSection } from "@/components/landing/ProductsSection";

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("Stream 3 - Landing & Public Pages Implementation Tests", () => {
  describe("About page truthfulness & core principles", () => {
    it("has removed fabricated metrics (50K+, 85%, 40+ countries, 4.9 rating)", () => {
      renderWithRouter(<About />);

      expect(screen.queryByText(/50K\+/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/85%/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/40\+ Countries/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/User Rating/i)).not.toBeInTheDocument();
    });

    it("renders authentic architecture capabilities and core engineering principles", () => {
      renderWithRouter(<About />);

      // Core principles
      expect(screen.getByText("Candidate-in-the-Loop")).toBeInTheDocument();
      expect(screen.getByText("Provenance Over Automation")).toBeInTheDocument();
      expect(screen.getByText("Local-First Data Ownership")).toBeInTheDocument();
      expect(screen.getByText("Anti-Ghost Verification")).toBeInTheDocument();

      // Authentic capabilities
      expect(screen.getByText("Candidate Review")).toBeInTheDocument();
      expect(screen.getByText("Deterministic schema")).toBeInTheDocument();
      expect(screen.getByText("Evidence-based framework")).toBeInTheDocument();
      expect(screen.getByText("Self-hostable offline pipeline")).toBeInTheDocument();
    });
  });

  describe("Landing page semantic styling and CTA structure", () => {
    it("renders intentional application messaging and structured workflow cards", () => {
      renderWithRouter(<LandingPage />);

      expect(screen.getByText(/Make every engineering application/i)).toBeInTheDocument();
      expect(screen.getByText(/more intentional/i)).toBeInTheDocument();
      expect(screen.getByText("A candidate-controlled career workspace")).toBeInTheDocument();
      expect(screen.getByText("Clear tools for a difficult job search")).toBeInTheDocument();
      expect(screen.getByText("Choose the workflow you need")).toBeInTheDocument();
    });
  });

  describe("FeaturesSection engineering copy and score formatting", () => {
    it("renders specific engineering pipeline header copy", () => {
      renderWithRouter(<FeaturesSection />);

      expect(screen.getByText("Engineering-Grade Application Pipeline")).toBeInTheDocument();
      expect(screen.queryByText("Everything You Need to Succeed")).not.toBeInTheDocument();
    });
  });

  describe("ProductsSection engineering copy and availability", () => {
    it("renders specific engineering product descriptions without hype buzzwords", () => {
      renderWithRouter(<ProductsSection />);

      expect(screen.getByText("Resume Optimizer")).toBeInTheDocument();
      expect(screen.getByText(/Parse job requirements and tailor your technical experience/i)).toBeInTheDocument();
      expect(screen.getByText("Job Search Engine")).toBeInTheDocument();
      expect(screen.getByText(/Filter verified engineering roles with transparent tech stacks/i)).toBeInTheDocument();
    });
  });
});
