import { mock, describe, test, expect } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResumeGraph from "@/pages/ResumeGraph";

mock.module("@/api", () => ({
  apiFetch: async () => ({
    nodes: [{ id: "1", label: "Node 1" }],
    links: [],
  }),
}));

describe("ResumeGraph page", () => {
  const runId = "test-run-id";

  test("renders resume graph page header and title", async () => {
    render(
      <MemoryRouter initialEntries={[`/resume-graph?runId=${runId}`]}>
        <Routes>
          <Route path="/resume-graph" element={<ResumeGraph />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText("Resume Graph").length).toBeGreaterThan(0));
  });
});
