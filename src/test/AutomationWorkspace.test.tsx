import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AutomationWorkspace from "@/pages/AutomationWorkspace";

describe("AutomationWorkspace", () => {
  it("shows the staged automation graph without implying execution", () => {
    render(<AutomationWorkspace />);

    expect(screen.getByText("Automation workspace is staged")).toBeInTheDocument();
    expect(screen.getByText("No automation was started and no external message was sent.")).toBeInTheDocument();
    expect(screen.getByText("Job discovery")).toBeInTheDocument();
    expect(screen.getByText("Pipeline care")).toBeInTheDocument();
    expect(screen.getByText("Research enrichment")).toBeInTheDocument();
    expect(screen.getByText("Interview workspace")).toBeInTheDocument();
    expect(screen.getByText("Outcome learning")).toBeInTheDocument();
    expect(screen.getByText("Approval delivery")).toBeInTheDocument();
  });
});
