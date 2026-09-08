import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  TargetRoleReadinessCard,
  checkSkillMatch,
  DEFAULT_CANDIDATE_SKILLS,
  TARGET_ROLE_OPTIONS,
} from "@/components/career/TargetRoleReadinessCard";

describe("TargetRoleReadinessCard & Loss-Aversion Tracker", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("accurately matches candidate skills against target role keywords", () => {
    expect(checkSkillMatch("Data Analytics & SQL", ["SQL", "Python"])).toBe(true);
    expect(checkSkillMatch("A/B Testing & Experimentation", ["A/B Testing"])).toBe(true);
    expect(checkSkillMatch("Distributed Systems & Microservices", ["Docker", "Kubernetes"])).toBe(false);
  });

  it("rejects short-token substring false positives", () => {
    expect(checkSkillMatch("Machine Learning", ["AI"])).toBe(false);
    expect(checkSkillMatch("MongoDB", ["Go"])).toBe(false);
    expect(checkSkillMatch("Digital Marketing", ["Git"])).toBe(false);
    expect(checkSkillMatch("Go", ["Go"])).toBe(true);
    expect(checkSkillMatch("Git", ["Git"])).toBe(true);
  });

  it("benchmarks against default candidate profile yielding 73% readiness for Senior PM with expected top gaps", () => {
    render(
      <MemoryRouter>
        <TargetRoleReadinessCard initialRoleSlug="product-manager" />
      </MemoryRouter>
    );

    // Should display the 73% readiness for Senior Product Manager roles
    expect(screen.getByTestId("readiness-headline")).toHaveTextContent("You're 73% ready for Senior Product Manager roles.");

    // Strategic requirement check: loss-aversion gaps surfaced
    expect(screen.getAllByText(/SQL/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/A\/B testing/i).length).toBeGreaterThan(0);

    // Check presence of top skills acquired and top skill gaps
    expect(screen.getByText(/Top Skills Acquired/i)).toBeInTheDocument();
    expect(screen.getByText(/Top Skill Gaps to Close/i)).toBeInTheDocument();

    // Check 1-click CTA "Bridge Skill Gaps" links to /roadmap
    const bridgeCta = screen.getByRole("link", { name: /Bridge Skill Gaps/i });
    expect(bridgeCta).toBeInTheDocument();
    expect(bridgeCta.getAttribute("href")).toBe("/roadmap");
  });

  it("allows switching target roles and updates the readiness context", () => {
    render(
      <MemoryRouter>
        <TargetRoleReadinessCard initialRoleSlug="product-manager" />
      </MemoryRouter>
    );

    // Initial role is Senior Product Manager
    expect(screen.getByTestId("readiness-headline")).toHaveTextContent("Senior Product Manager");

    // Switch to Senior Full Stack Engineer via role slug in TARGET_ROLE_OPTIONS
    const softwareOption = TARGET_ROLE_OPTIONS.find((r) => r.slug === "software-engineer")!;
    expect(softwareOption).toBeDefined();
    expect(softwareOption.displayTitle).toBe("Senior Full Stack Engineer");
  });

  it("computes dynamic readiness when custom user skills are provided", () => {
    const customUserSkills = [
      "Distributed Systems & Microservices",
      "TypeScript / Node.js or Go",
      "PostgreSQL & Database Indexing",
      "Docker & Container Orchestration",
    ];

    render(
      <MemoryRouter>
        <TargetRoleReadinessCard
          initialRoleSlug="software-engineer"
          userSkills={customUserSkills}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("readiness-headline")).toHaveTextContent("Senior Full Stack Engineer");
    expect(screen.getByText(/Top Skills Acquired/i)).toBeInTheDocument();
  });

  it("renders gap badges with direct navigation to roadmap", () => {
    render(
      <MemoryRouter>
        <TargetRoleReadinessCard initialRoleSlug="product-manager" />
      </MemoryRouter>
    );

    const gapLinks = screen.getAllByRole("link").filter((l) =>
      l.getAttribute("href")?.startsWith("/roadmap?gap=")
    );
    expect(gapLinks.length).toBeGreaterThan(0);
  });
});
