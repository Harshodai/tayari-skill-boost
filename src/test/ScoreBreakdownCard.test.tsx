import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoreBreakdownCard } from "@/components/resume/ScoreBreakdownCard";
import type { ScoreBreakdown } from "@/types/resume";

describe("ScoreBreakdownCard Component", () => {
  const mockBreakdownWithStuffing: ScoreBreakdown = {
    structural_ats: 88,
    semantic_fit: 82,
    experience_relevance: 90,
    achievement_quality: 78,
    seniority_alignment: "aligned",
    keyword_coverage: 85,
    keyword_stuffing_penalty: {
      count: 5,
      penalty_points: 15,
      flagged_keywords: [
        {
          keyword: "kubernetes",
          count: 5,
          example: "Led kubernetes deployments with automated kubernetes clusters",
          penalty: 15,
        },
      ],
    },
    unsupported_claims_count: 2,
    confidence_band: "high",
    human_rationale: "Strong technical background with verified infrastructure experience, but excessive keyword repetition flagged in bullet points.",
  };

  const mockCleanBreakdown: ScoreBreakdown = {
    structural_ats: 92,
    semantic_fit: 89,
    experience_relevance: 95,
    achievement_quality: 85,
    seniority_alignment: "aligned",
    keyword_coverage: 88,
    keyword_stuffing_penalty: {
      count: 0,
      penalty_points: 0,
      flagged_keywords: [],
    },
    unsupported_claims_count: 0,
    confidence_band: "high",
    human_rationale: "Well-structured resume with balanced keyword distribution and strong quantified achievements.",
  };

  it("renders all transparent dimensions and confidence band", () => {
    render(<ScoreBreakdownCard breakdown={mockBreakdownWithStuffing} />);

    expect(screen.getByText(/Trust-First Score Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH Confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Unverified Claims/i)).toBeInTheDocument();

    // Check dimensions
    expect(screen.getByText("Structural ATS")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();

    expect(screen.getByText("Semantic Fit")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();

    expect(screen.getByText("Experience Relevance")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();

    expect(screen.getByText("Achievement Quality")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();

    expect(screen.getByText("Keyword Coverage")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();

    expect(screen.getByText("Seniority Alignment")).toBeInTheDocument();
    expect(screen.getByText("Aligned")).toBeInTheDocument();
  });

  it("renders keyword stuffing penalty banner and reveals flagged terms on click", () => {
    render(<ScoreBreakdownCard breakdown={mockBreakdownWithStuffing} />);

    expect(screen.getByTestId("keyword-stuffing-penalty")).toBeInTheDocument();
    expect(screen.getByText(/Keyword Stuffing Penalty Applied/i)).toBeInTheDocument();
    expect(screen.getByText(/-15 pts/i)).toBeInTheDocument();

    // Click to review flagged terms
    const reviewBtn = screen.getByRole("button", { name: /Review \(1\)/i });
    fireEvent.click(reviewBtn);

    expect(screen.getByText(/"kubernetes"/i)).toBeInTheDocument();
    expect(screen.getByText(/5 occurrences across bullets/i)).toBeInTheDocument();
    expect(screen.getByText(/Led kubernetes deployments with automated kubernetes clusters/i)).toBeInTheDocument();
  });

  it("renders clean scan badge when no keyword stuffing is detected", () => {
    render(<ScoreBreakdownCard breakdown={mockCleanBreakdown} />);

    expect(screen.getByTestId("keyword-stuffing-clean")).toBeInTheDocument();
    expect(screen.getByText(/Zero Keyword Stuffing Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Clean Scan/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Unverified Claims/i)).toBeInTheDocument();
  });

  it("renders human rationale text accurately", () => {
    render(<ScoreBreakdownCard breakdown={mockBreakdownWithStuffing} />);

    expect(screen.getByTestId("human-rationale-section")).toBeInTheDocument();
    expect(screen.getByText(/Strong technical background with verified infrastructure experience/i)).toBeInTheDocument();
  });

  it("renders safe placeholder when breakdown is null", () => {
    render(<ScoreBreakdownCard breakdown={null} />);
    expect(screen.getByText(/Trust-First ATS Score Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Run an ATS analysis or resume optimization/i)).toBeInTheDocument();
  });
});
