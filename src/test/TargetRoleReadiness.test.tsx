import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("benchmarks against default candidate profile yielding computed readiness for Senior PM with expected top gaps", () => {
    render(
      <MemoryRouter>
        <TargetRoleReadinessCard initialRoleSlug="product-manager" />
      </MemoryRouter>
    );

    // Score is dynamically computed from DEFAULT_CANDIDATE_SKILLS (69% for product-manager).
    const headline = screen.getByTestId("readiness-headline");
    expect(headline).toHaveTextContent("You're 69% ready for Senior Product Manager roles.");

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
    // Verify software-engineer option exists and has correct display title
    const softwareOption = TARGET_ROLE_OPTIONS.find((r) => r.slug === "software-engineer")!;
    expect(softwareOption).toBeDefined();
    expect(softwareOption.displayTitle).toBe("Senior Full Stack Engineer");

    render(
      <MemoryRouter>
        <TargetRoleReadinessCard initialRoleSlug="software-engineer" />
      </MemoryRouter>
    );

    expect(screen.getByTestId("readiness-headline")).toHaveTextContent("Senior Full Stack Engineer");

    const combobox = screen.getByRole("combobox", { name: /Select Target Role/i });
    expect(combobox).toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    const productManagerOption = screen.getByRole("option", { name: /Senior Product Manager/i });
    fireEvent.click(productManagerOption);

    expect(screen.getByTestId("readiness-headline")).toHaveTextContent("Senior Product Manager");
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

    // Assert that the computed percentage is present in the headline (not hardcoded).
    // 4 skills out of 10 match; score = round(4.9 / 11.5 * 100) = 43%.
    expect(screen.getByTestId("readiness-headline")).toHaveTextContent("43%");

    // Assert the acquired skill count matches the 4 matched skills.
    expect(screen.getByText(/Top Skills Acquired \(4\)/i)).toBeInTheDocument();
    const acquiredSection = screen.getByText(/Top Skills Acquired/i).closest("div.p-4");
    expect(acquiredSection).toBeTruthy();
    const acquiredScope = within(acquiredSection!);
    expect(acquiredScope.getByText("Distributed Systems & Microservices")).toBeInTheDocument();
    expect(acquiredScope.getByText("TypeScript / Node.js or Go")).toBeInTheDocument();
    expect(acquiredScope.getByText("PostgreSQL & Database Indexing")).toBeInTheDocument();
    expect(acquiredScope.getByText("Docker & Kubernetes Orchestration")).toBeInTheDocument();

    // Assert there are missing skills listed in the "Top Skill Gaps to Close" section.
    expect(screen.getByText(/Top Skill Gaps to Close/i)).toBeInTheDocument();
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
