import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SocialProofSection } from "@/components/landing/SocialProofSection";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("SocialProofSection", () => {
  it("renders an honest public evidence story without fetching account-scoped activity", () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    render(
      <MemoryRouter>
        <SocialProofSection />
      </MemoryRouter>
    );

    expect(screen.getByText(/Candidate-owned context/i)).toBeInTheDocument();
    expect(screen.getByText(/Build progress you can explain/i)).toBeInTheDocument();
    expect(screen.getByText(/personal activity belongs in your signed-in workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep the role in context/i)).toBeInTheDocument();
    expect(screen.getByText(/Leave a learning trail/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
