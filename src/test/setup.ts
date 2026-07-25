import { expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
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
