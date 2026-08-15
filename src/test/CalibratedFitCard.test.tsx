import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CalibratedFitCard, getFitBand } from "@/components/jobs/CalibratedFitCard";

describe("CalibratedFitCard Component", () => {
  it("computes correct fit bands across score ranges", () => {
    expect(getFitBand(null).label).toContain("Unranked");
    expect(getFitBand(undefined).label).toContain("Unranked");
    expect(getFitBand(92).label).toContain("Strong Fit");
    expect(getFitBand(72).label).toContain("Moderate Fit");
    expect(getFitBand(55).label).toContain("Transferable Match");
    expect(getFitBand(30).label).toContain("Skill Gap Heavy");
  });

  it("renders unranked state honestly without magic percentage", () => {
    render(
      <BrowserRouter>
        <CalibratedFitCard score={null} matchedSkills={[]} missingSkills={[]} />
      </BrowserRouter>
    );
    expect(screen.getByText(/Unranked \(AI offline\)/i)).toBeInTheDocument();
    expect(screen.getByText(/No direct skill overlap identified/i)).toBeInTheDocument();
  });

  it("renders verified matched skills and missing skill chips", () => {
    render(
      <BrowserRouter>
        <CalibratedFitCard
          score={85}
          matchedSkills={["Go", "Kubernetes", "Redis"]}
          missingSkills={["Kafka"]}
          matchReason="Strong microservices background"
          atsProvider="Greenhouse"
          transitionType="cross_domain"
        />
      </BrowserRouter>
    );

    expect(screen.getByText(/Strong Fit \(85%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Strong microservices background/i)).toBeInTheDocument();
    expect(screen.getByText(/✓ Go/i)).toBeInTheDocument();
    expect(screen.getByText(/✓ Kubernetes/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ Kafka/i)).toBeInTheDocument();
    expect(screen.getByText(/Greenhouse/i)).toBeInTheDocument();
    expect(screen.getByText(/Cross-Domain Weighting/i)).toBeInTheDocument();
  });
});
