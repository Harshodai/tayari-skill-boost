import "./setup";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import { EDUCATIONAL_ARTICLES } from "@/data/educationalArticles";

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div data-testid="layout-wrapper">{children}</div>,
}));

vi.mock("@/components/seo/Seo", () => ({
  Seo: () => <div data-testid="seo-wrapper" />,
  SITE_URL: "https://tayari-skill-boost.lovable.app",
}));

// Mock Supabase to simulate empty table or network outage
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        not: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: new Error("Row not found") }),
        }),
      }),
    }),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("Educational Articles Blog Fallback", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("renders educational articles on Blog page when database is empty", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/blog"]}>
          <Blog />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Featured article should be displayed
    await waitFor(() => {
      expect(screen.getByText("Why Your Resume Gets Rejected by ATS (And How to Fix It)")).toBeInTheDocument();
    });

    // Other articles should also be rendered in the grid
    expect(screen.getByText("The Truth About Keyword Stuffing: Why Transparent AI Resumes Win")).toBeInTheDocument();
    expect(screen.getByText("How to Tailor Your Resume Without Losing Your Authentic Voice")).toBeInTheDocument();
  });

  it("renders educational article details seamlessly on BlogPost page when database lookup fails", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/blog/why-resume-gets-rejected-by-ats"]}>
          <Routes>
            <Route path="/blog/:slug" element={<BlogPost />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should load the educational post from fallback
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Why Your Resume Gets Rejected by ATS (And How to Fix It)");
    });

    expect(screen.getByText(/Over 75% of qualified applicants are silently filtered out/i)).toBeInTheDocument();
    expect(screen.getByText("Job Tayari Research Team")).toBeInTheDocument();
    expect(screen.getByText("8 min read")).toBeInTheDocument();
  });
});
