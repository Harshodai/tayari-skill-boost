import "./setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  COURSE_RECOMMENDATIONS,
  getCourseRecommendationsForGaps,
} from "@/data/courseRecommendations";
import { SAMPLE_PRESETS } from "@/data/samplePresets";
import { Confetti } from "@/components/ui/confetti";
import { HeroSection } from "@/components/landing/HeroSection";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Skill Gap Course Recommendations", () => {
  it("contains curated courses for major skills", () => {
    expect(COURSE_RECOMMENDATIONS.length).toBeGreaterThanOrEqual(8);
    const skills = COURSE_RECOMMENDATIONS.map((c) => c.skill);
    expect(skills).toContain("Kubernetes");
    expect(skills).toContain("Kafka");
    expect(skills).toContain("System Design");
    expect(skills).toContain("GraphQL");
    expect(skills).toContain("Next.js");
    expect(skills).toContain("PyTorch");
    expect(skills).toContain("Golang");
    expect(skills).toContain("AWS");

    for (const course of COURSE_RECOMMENDATIONS) {
      expect(course.title).toBeTruthy();
      expect(course.provider).toBeTruthy();
      expect(course.duration).toBeTruthy();
      expect(course.rating).toBeGreaterThan(4.0);
      expect(course.affiliateUrl).toBeTruthy();
      expect(course.description).toBeTruthy();
    }
  });

  it("matches course recommendations based on candidate skill gaps", () => {
    const k8sMatches = getCourseRecommendationsForGaps(["Kubernetes", "Docker"]);
    expect(k8sMatches.some((c) => c.skill === "Kubernetes" || c.skill === "Docker")).toBe(true);

    const kafkaMatches = getCourseRecommendationsForGaps(["Apache Kafka Streams"]);
    expect(kafkaMatches.some((c) => c.skill === "Kafka")).toBe(true);

    const sysDesignMatches = getCourseRecommendationsForGaps(["Distributed System Architecture"]);
    expect(sysDesignMatches.some((c) => c.skill === "System Design")).toBe(true);

    const golangMatches = getCourseRecommendationsForGaps(["Go Programming"]);
    expect(golangMatches.some((c) => c.skill === "Golang")).toBe(true);
  });

  it("provides graceful fallback recommendations when gaps are empty or unlisted", () => {
    const fallback = getCourseRecommendationsForGaps([]);
    expect(fallback.length).toBeGreaterThanOrEqual(2);
    expect(fallback[0].title).toBeTruthy();

    const customFallback = getCourseRecommendationsForGaps(["UnknownLegacySkillXYZ"]);
    expect(customFallback.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Sample Presets", () => {
  it("includes presets for Stripe, Cloudflare, and Linear", () => {
    const companies = SAMPLE_PRESETS.map((p) => p.company);
    expect(companies).toContain("Stripe");
    expect(companies).toContain("Cloudflare");
    expect(companies).toContain("Linear");

    for (const preset of SAMPLE_PRESETS) {
      expect(preset.resume.length).toBeGreaterThan(50);
      expect(preset.jd.length).toBeGreaterThan(50);
      expect(preset.label).toBeTruthy();
    }
  });
});

describe("Confetti Component", () => {
  it("renders celebration confetti pieces without error", () => {
    const { container } = render(<Confetti count={20} />);
    const confettiContainer = container.querySelector("[aria-hidden='true']");
    expect(confettiContainer).toBeInTheDocument();
  });
});

describe("HeroSection 60-Second Magic Moment Intake", () => {
  it("renders the quick-scan intake card directly on hero", () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    expect(screen.getByText(/60-Second ATS Gap Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Instant • 60s Magic Moment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run 60s Gap Analysis/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stripe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cloudflare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Linear" })).toBeInTheDocument();
  });

  it("switches presets and navigates to /free-scan with prefilled state", () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>
    );

    // Switch to Linear preset
    fireEvent.click(screen.getByRole("button", { name: "Linear" }));

    // Click Run 60s Gap Analysis
    fireEvent.click(screen.getByRole("button", { name: /Run 60s Gap Analysis/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/free-scan", {
      state: expect.objectContaining({
        activePreset: "Linear",
        autoScan: true,
      }),
    });
  });
});
