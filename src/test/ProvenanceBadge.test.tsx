import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";

describe("ProvenanceBadge", () => {
  it("renders the AI-assisted disclosure state", () => {
    render(<ProvenanceBadge classification="ai_assisted" />);
    expect(screen.getByText("Created with AI assistance")).toBeInTheDocument();
  });

  it("renders unknown provenance instead of inferring human authorship", () => {
    render(<ProvenanceBadge classification="unknown" />);
    expect(screen.getByText("Origin not recorded")).toBeInTheDocument();
  });

  it("renders disputed provenance as under review", () => {
    render(<ProvenanceBadge classification="disputed" />);
    expect(screen.getByText("Origin under review")).toBeInTheDocument();
  });
});
