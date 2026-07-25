import { mock, describe, test, expect } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResumeGraph from "@/pages/ResumeGraph";

mock.module("@/api", () => ({
  apiFetch: async () => ({
    nodes: [{ id: "1", label: "Node1" }, { id: "2", label: "Node2" }],
    links: [{ source: "1", target: "2" }],
  }),
}));

mock.module("html-to-image", () => ({
  toBlob: async () => new Blob(["pngdata"], { type: "image/png" }),
}));

describe("ResumeGraph export buttons", () => {
  test("Export PNG and GraphML options exist", async () => {
    render(
      <MemoryRouter initialEntries={["/resume-graph?runId=123"]}>
        <Routes>
          <Route path="/resume-graph" element={<ResumeGraph />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText(/Export PNG/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Export GraphML/i).length).toBeGreaterThan(0);
  });
});
