import { test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ResumeGraphViz, GraphData } from "@/components/ResumeGraphViz";

function getMockGraph(): GraphData {
  return {
    nodes: [
      { id: "a", label: "Node A" },
      { id: "b", label: "Node B" },
    ],
    links: [{ source: "a", target: "b" }],
  };
}

test("renders SVG and node labels", () => {
  render(<ResumeGraphViz graph={getMockGraph()} />);
  expect(screen.getAllByRole("img", { name: /resume knowledge graph/i }).length).toBeGreaterThan(0);
  expect(screen.getByText("Node A")).toBeInTheDocument();
  expect(screen.getByText("Node B")).toBeInTheDocument();
});
