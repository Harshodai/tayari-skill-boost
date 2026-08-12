import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chart, DataPoint } from "@/components/charts/Chart";

const sampleData: DataPoint[] = [
  { name: "Skill A", value: 10 },
  { name: "Skill B", value: 20 },
];

test("renders chart with accessible title and container element", () => {
  render(<Chart data={sampleData} title="Sample Chart" />);
  expect(screen.getByText("Sample Chart")).toBeInTheDocument();
  const container = screen.getByRole("img", { name: "Sample Chart" });
  expect(container).toBeInTheDocument();
});
