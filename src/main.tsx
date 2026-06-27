import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});
import { ThemeProvider } from "./contexts/ThemeContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "./index.css";

// Build-time guard: fail fast with an actionable message if the Supabase
// env vars are missing from the bundle (e.g. stale build before .env existed).
declare const __SUPABASE_FINGERPRINT__: string;
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  const msg =
    "Supabase env vars missing from this build. Re-publish the project to bake VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY into the bundle.";
  // eslint-disable-next-line no-console
  console.error(msg, { fingerprint: __SUPABASE_FINGERPRINT__ });
}



createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <TenantProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </TenantProvider>
  </ThemeProvider>
);

