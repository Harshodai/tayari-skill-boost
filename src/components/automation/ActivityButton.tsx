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
      className={cn("relative gap-2", className)}
      aria-label="Open activity"
    >
      <Activity className="w-4 h-4" />
      <span className="hidden sm:inline text-sm">Activity</span>
      {active > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
          {active}
        </span>
      )}
    </Button>
  );
}
