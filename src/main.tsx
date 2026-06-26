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

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <TenantProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </TenantProvider>
  </ThemeProvider>
);

