import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { useAutomation } from "@/contexts/AutomationContext";
import { cn } from "@/lib/utils";

export function ActivityButton({ className }: { className?: string }) {
  const { runs, open } = useAutomation();
  const active = runs.filter((r) => r.steps.some((s) => s.status === "running" || s.status === "queued")).length;
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
