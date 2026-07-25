import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SocialProofSection } from "@/components/landing/SocialProofSection";

describe("SocialProofSection", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders social proof section headers, trust logos, and aspirational cards", () => {
    render(
      <MemoryRouter>
        <SocialProofSection />
      </MemoryRouter>
    );
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText(/From application to offer/i)).toBeInTheDocument();
  });

  it("fetches dashboard stats API and renders formatted values", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          resumes_count: 850,
          profile_completion_pct: 95,
          applications_count: 1400,
          interviews_count: 420,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    render(
      <MemoryRouter>
        <SocialProofSection />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/850/)).toBeInTheDocument();
      expect(screen.getByText(/95/)).toBeInTheDocument();
      expect(screen.getByText(/1,400/)).toBeInTheDocument();
      expect(screen.getByText(/420/)).toBeInTheDocument();
    });
  });
});
