import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Keep the standard test runner independent of Bun. The application uses a
 * browser-like DOM and the same `@` source alias as Vite production builds.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    clearMocks: true,
    restoreMocks: true,
  },
});
