import { mock, describe, test, expect, beforeEach, afterEach } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResumeGraph from "@/pages/ResumeGraph";

// ponytail: stub globalThis.fetch instead of mock.module("@/api") — the
// barrel mock leaks into every other test file in the run (it replaces
// @/api/client too), breaking tests that exercise the real client.
const mockFetch = mock(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

mock.module("html-to-image", () => ({
  toBlob: async () => new Blob(["pngdata"], { type: "image/png" }),
}));

describe("ResumeGraph export buttons", () => {
  test("Export PNG and GraphML options exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          nodes: [{ id: "1", label: "Node1" }, { id: "2", label: "Node2" }],
          links: [{ source: "1", target: "2" }],
        }),
    } as any);

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
