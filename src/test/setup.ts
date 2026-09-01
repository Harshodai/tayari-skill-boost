import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());
expect.extend(matchers);

// Mock window.scrollTo
global.scrollTo = () => { };
if (global.window) {
    Object.defineProperty(global.window, 'scrollTo', { value: () => { }, writable: true });
}

// Mock Environment Variables for Tests
process.env.VITE_API_URL = process.env.VITE_API_URL || "http://localhost:8085";
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://mock.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "mock-key";

// Tests must never attempt a real backend call. Individual API tests replace
// this stub and restore it after asserting their own request contract.
globalThis.fetch = vi.fn(async () =>
  new Response(JSON.stringify({ error: "Test backend unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  })
) as typeof fetch;

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => children ?? null,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

