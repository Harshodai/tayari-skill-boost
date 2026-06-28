import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResumeGraph from "@/pages/ResumeGraph";

// Mock fetch globally
const mockFetch = jest.fn();
Object.defineProperty(global, "fetch", { value: mockFetch, writable: true });

// Mock URL.createObjectURL
const createObjectURLMock = jest.fn(() => "blob:url");
Object.defineProperty(URL, "createObjectURL", { value: createObjectURLMock, writable: true });

describe("ResumeGraph page", () => {
  const runId = "test-run-id";
  const graphData = { nodes: [], links: [] };

  beforeEach(() => {
    mockFetch.mockReset();
    // GET graph data
    mockFetch.mockImplementation((url: RequestInfo, options?: RequestInit) => {
      if (typeof url === "string" && url.includes(`/v1/resume-graph/${runId}`) && (!options || !options.method)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(graphData) } as any);
      }
      if (typeof url === "string" && url.includes(`/v1/resume-graph/${runId}/export`)) {
        const blob = new Blob([JSON.stringify(graphData)], { type: "application/json" });
        return Promise.resolve({ ok: true, blob: () => Promise.resolve(blob) } as any);
      }
      if (typeof url === "string" && url.includes(`/v1/resume-graph/${runId}`) && options?.method === "DELETE") {
        return Promise.resolve({ ok: true } as any);
      }
      return Promise.reject(new Error("Unexpected fetch"));
    });
  });

  test("download button triggers fetch and creates blob URL", async () => {
    render(
      <MemoryRouter initialEntries={[`/resume-graph?runId=${runId}`]}>
        <Routes>
          <Route path="/resume-graph" element={<ResumeGraph />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for graph data to load
    await waitFor(() => expect(screen.getByText("Resume Graph")).toBeInTheDocument());
    const downloadBtn = screen.getByRole("button", { name: /download json/i });
    fireEvent.click(downloadBtn);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(`/v1/resume-graph/${runId}/export`));
    expect(createObjectURLMock).toHaveBeenCalled();
  });

  test("delete button clears graph from UI", async () => {
    render(
      <MemoryRouter initialEntries={[`/resume-graph?runId=${runId}`]}>
        <Routes>
          <Route path="/resume-graph" element={<ResumeGraph />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Resume Graph")).toBeInTheDocument());
    const deleteBtn = screen.getByRole("button", { name: /delete graph/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(`/v1/resume-graph/${runId}`, { method: "DELETE" }));
    // After deletion, buttons should disappear as data is cleared
    expect(screen.queryByRole("button", { name: /download json/i })).not.toBeInTheDocument();
  });
});
