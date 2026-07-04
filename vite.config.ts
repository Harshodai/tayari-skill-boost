import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { createHash } from "crypto";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Fingerprint Supabase env so any change to URL/keys produces a
  // distinct bundle hash — guarantees a fresh build/cache bust.
  const supabaseFingerprint = createHash("sha256")
    .update(
      [
        env.VITE_SUPABASE_URL ?? "",
        env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        env.VITE_SUPABASE_PROJECT_ID ?? "",
      ].join("|")
    )
    .digest("hex")
    .slice(0, 12);

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger(), mcpPlugin()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __SUPABASE_FINGERPRINT__: JSON.stringify(supabaseFingerprint),
    },
    build: {
      // Note: do NOT use a naive per-package manualChunks splitter here.
      // Splitting every node_modules folder into its own chunk breaks scoped
      // packages whose subpackages share module-level state (e.g. @sentry/*,
      // @sentry-internal/*, @radix-ui/*) and produces TDZ errors like
      // "Cannot access 'Gt' before initialization" at runtime. Let Rollup
      // handle chunking automatically.
      chunkSizeWarningLimit: 1200,
      cssCodeSplit: true,
    },
  };
});
