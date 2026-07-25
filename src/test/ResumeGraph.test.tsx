import { mock, test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResumeGraph from "@/pages/ResumeGraph";

mock.module("@/api", () => ({
  apiFetch: async () => ({
    nodes: [
      { id: "1", label: "Node 1" },
      { id: "2", label: "Node 2" },
    ],
    links: [{ source: "1", target: "2" }],
  }),
}));

test("renders fetched resume graph visualization", async () => {
  render(
    <MemoryRouter initialEntries={["/resume-graph?runId=123"]}>
      <Routes>
        <Route path="/resume-graph" element={<ResumeGraph />} />
      </Routes>
    </MemoryRouter>
  );

  const viz = await screen.findByRole("img", { name: /resume knowledge graph/i });
  expect(viz).toBeInTheDocument();
});
