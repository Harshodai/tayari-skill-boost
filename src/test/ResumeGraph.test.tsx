import { mock, test, expect, beforeEach, afterEach } from "bun:test";
import { render, screen } from "@testing-library/react";
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

test("renders fetched resume graph visualization", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        nodes: [
          { id: "1", label: "Node 1" },
          { id: "2", label: "Node 2" },
        ],
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

  const viz = await screen.findByRole("img", { name: /resume knowledge graph/i });
  expect(viz).toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining(`/v1/resume-graph/123?format=raw`),
    expect.any(Object)
  );
});
