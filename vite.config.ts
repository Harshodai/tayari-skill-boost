import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
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
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __SUPABASE_FINGERPRINT__: JSON.stringify(supabaseFingerprint),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0];
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
      cssCodeSplit: true,
    },
  };
});
