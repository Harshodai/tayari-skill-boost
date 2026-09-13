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

// Mock localStorage for HappyDOM / Node 22 test environment
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== "function") {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  if (globalThis.window) {
    Object.defineProperty(globalThis.window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  }
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

