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

test("renders SVG and node labels", async () => {
  render(<ResumeGraphViz graph={getMockGraph()} />);

  // Accessibility role check
  expect(screen.getByRole("img", { name: /resume knowledge graph/i })).toBeInTheDocument();

  // SVG presence
  const svg = document.querySelector("svg");
  expect(svg).toBeInTheDocument();

  // Node labels should appear in the DOM (as <text> elements)
  expect(screen.getByText("Node A")).toBeInTheDocument();
  expect(screen.getByText("Node B")).toBeInTheDocument();
});
