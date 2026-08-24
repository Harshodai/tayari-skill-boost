import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { redactSensitiveKeys, truncateConsoleMessage } from "./lib/telemetry-scrub";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "console" && typeof breadcrumb.message === "string") {
      breadcrumb.message = truncateConsoleMessage(breadcrumb.message);
    }
    breadcrumb.data = redactSensitiveKeys(breadcrumb.data);
    return breadcrumb;
  },
  beforeSend(event) {
    event.extra = redactSensitiveKeys(event.extra);
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
});
import { ThemeProvider } from "./contexts/ThemeContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initPerformanceMonitoring } from "./lib/performance";

if (import.meta.env.PROD) {
  initPerformanceMonitoring();
}
// Note: removed @fontsource/sora — we now rely on the system SF/Inter stack
// configured in tailwind.config.ts + index.css for an Apple-native look.
import "./index.css";

// Build-time guard: fail fast with an actionable message if the Supabase
// env vars are missing from the bundle (e.g. stale build before .env existed).
declare const __SUPABASE_FINGERPRINT__: string;
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  const msg =
    "Supabase env vars missing from this build. Re-publish the project to bake VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY into the bundle.";
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

