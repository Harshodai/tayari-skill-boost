import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiFetchResponse, apiFetch } from "@/api";

export function DemoModeBanner() {
  const [isMockMode, setIsMockMode] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await apiFetch<any>("/v1/health").catch(() => null) || await apiFetchResponse("/healthz").then(r => r.json()).catch(() => null);
        if (res && isMounted) {
          const isMock =
            res.active_engine === "mock" ||
            res.active_engine === "mock-fallback" ||
            res.model_status === "llm_not_configured" ||
            res.mock === true;
          setIsMockMode(Boolean(isMock));
        }
      } catch (err) {
        // Silently ignore network failures in health check
      }
    };
    checkHealth();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isMockMode) return null;

  return (
    <div
      role="banner"
      className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs md:text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2 flex-shrink-0"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <span>
        <strong>DEMO MODE</strong> — configure an LLM for real results
      </span>
    </div>
  );
}
