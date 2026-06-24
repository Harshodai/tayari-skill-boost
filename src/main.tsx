import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TenantProvider } from "./contexts/TenantContext";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <TenantProvider>
      <App />
    </TenantProvider>
  </ThemeProvider>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("ServiceWorker registration successful with scope: ", reg.scope);
      })
      .catch((err) => {
        console.log("ServiceWorker registration failed: ", err);
      });
  });
}

