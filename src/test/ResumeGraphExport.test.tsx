// src/test/ResumeGraphExport.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResumeGraph from "@/pages/ResumeGraph";

// Mock apiFetch to return a simple graph
jest.mock("@/api", () => ({
  apiFetch: jest.fn(),
}));

// Mock html-to-image to return a dummy Blob
jest.mock("html-to-image", () => ({
  toBlob: jest.fn(() => Promise.resolve(new Blob(["pngdata"], { type: "image/png" }))),
}));

const mockGraphData = {
  nodes: [{ id: "1", label: "Node1" }, { id: "2", label: "Node2" }],
  links: [{ source: "1", target: "2" }],
};

describe("ResumeGraph export buttons", () => {
  beforeEach(() => {
    const { apiFetch } = require("@/api");
    apiFetch.mockResolvedValueOnce(mockGraphData);
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => "blob:url");
    // Spy on document.createElement for anchor
    jest.spyOn(document, "createElement");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Export PNG triggers download", async () => {
    render(
      <MemoryRouter initialEntries={["/resume-graph?runId=123"]}>
        <Routes>
          <Route path="/resume-graph" element={<ResumeGraph />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for graph to load and buttons appear
    await waitFor(() => expect(screen.getByLabelText(/Export graph as PNG/i)).toBeInTheDocument());

    const exportBtn = screen.getByLabelText(/Export graph as PNG/i);
    fireEvent.click(exportBtn);

    // Verify anchor creation with correct download attribute
    const aElem = (document.createElement as jest.Mock).mock.results[0].value as HTMLAnchorElement;
    expect(aElem.download).toBe("resume-graph-123.png");
    expect(aElem.href).toBe("blob:url");
  });

  test("Export GraphML triggers download", async () => {
    render(
      <MemoryRouter initialEntries={["/resume-graph?runId=abc"]}>
        <Routes>
          <Route path="/resume-graph" element={<ResumeGraph />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByLabelText(/Export graph as GraphML/i)).toBeInTheDocument());
    const exportBtn = screen.getByLabelText(/Export graph as GraphML/i);
    fireEvent.click(exportBtn);

    const aElem = (document.createElement as jest.Mock).mock.results[0].value as HTMLAnchorElement;
    expect(aElem.download).toBe("resume-graph-abc.graphml");
    expect(aElem.href).toBe("blob:url");
  });
});
