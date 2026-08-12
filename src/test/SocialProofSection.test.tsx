import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SocialProofSection } from "@/components/landing/SocialProofSection";

describe("SocialProofSection", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders social proof headers, testimonials, and aspirational cards", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          resumes_count: 17,
          profile_completion_pct: 0,
          applications_count: 0,
          saved_jobs_count: 0,
          interviews_count: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    render(
      <MemoryRouter>
        <SocialProofSection />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/17/)).toBeInTheDocument());
    expect(screen.getByText(/What early users say/i)).toBeInTheDocument();
    expect(screen.getByText(/Live platform activity/i)).toBeInTheDocument();
    expect(screen.getByText(/From application to offer/i)).toBeInTheDocument();
  });

  it("fetches dashboard stats API and renders formatted values", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          resumes_count: 850,
          profile_completion_pct: 95,
          applications_count: 1400,
          saved_jobs_count: 95,
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
