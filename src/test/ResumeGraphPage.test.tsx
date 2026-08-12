import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResumeGraph from "@/pages/ResumeGraph";

// ponytail: stub globalThis.fetch instead of vi.mock("@/api") — the
// barrel mock leaks into every other test file in the run (it replaces
// @/api/client too), breaking tests that exercise the real client.
const mockFetch = vi.fn(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockReset();
  mockFetch.mockImplementation(() => Promise.resolve(new Response()));
  globalThis.fetch = mockFetch as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ResumeGraph page", () => {
  const runId = "test-run-id";

  test("renders resume graph page header and title", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ nodes: [{ id: "1", label: "Node 1" }], links: [] }),
    } as any);

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
