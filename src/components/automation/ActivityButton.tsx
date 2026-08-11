import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { useAutomation } from "@/contexts/AutomationContext";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/api";
import { useEffect, useState } from "react";

// ponytail: poll server /runs/active every 15s so the chip reflects background
// Celery runs, not just the client-side FSM. Falls back to client count on
// error/401. Merge by max so a run visible locally isn't hidden by a stale poll.
const ACTIVE_POLL_MS = 15000;

export function ActivityButton({ className }: { className?: string }) {
  const { runs, open } = useAutomation();
  const clientActive = runs.filter((r) => r.steps.some((s) => s.status === "running" || s.status === "queued")).length;
  const [serverActive, setServerActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiFetch<{ count?: number }>(`/v1/agent/runs/active`);
        if (!cancelled && typeof data?.count === "number") setServerActive(data.count);
      } catch {
        // ponytail: 401/network → silently keep client count; not worth a toast
      }
    };
    poll();
    const id = setInterval(poll, ACTIVE_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const active = Math.max(clientActive, serverActive);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={open}
      className={cn(
        "relative gap-2 transition-all duration-300", 
        active > 0 && "bg-primary/5 hover:bg-primary/10 border border-primary/20 shadow-[0_0_12px_rgba(var(--primary),0.15)]",
        className
      )}
      aria-label="Open activity"
    >
      <Activity className={cn("w-4 h-4", active > 0 && "text-primary animate-pulse")} />
      <span className="hidden sm:inline text-sm">Activity</span>
      {active > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative rounded-full h-4 w-4 bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
            {active}
          </span>
        </span>
      )}
    </Button>
  );
}
