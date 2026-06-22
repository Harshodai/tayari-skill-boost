import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Clock, AlertCircle, Activity, Trash2 } from "lucide-react";
import { useAutomation, AutomationStatus } from "@/contexts/AutomationContext";
import { cn } from "@/lib/utils";

const statusIcon = (s: AutomationStatus) => {
  switch (s) {
    case "done":
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case "failed":
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

export function ActivityDrawer() {
  const { runs, isOpen, close, clearCompleted } = useAutomation();
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border/60">
          <SheetTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Activity
          </SheetTitle>
          <SheetDescription>
            Live view of automations running across Tayari.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {runs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No active automations. Trigger one from Search, Resume, or the Dashboard.
            </div>
          ) : (
            runs.map((r) => {
              const done = r.steps.filter((s) => s.status === "done").length;
              const allDone = done === r.steps.length;
              return (
                <div
                  key={r.id}
                  className={cn(
                    "rounded-lg border bg-card/60 p-4 transition-colors",
                    allDone ? "border-success/30" : "border-border/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      {r.context && (
                        <p className="text-xs text-muted-foreground truncate">{r.context}</p>
                      )}
                    </div>
                    <Badge variant={allDone ? "default" : "secondary"} className="shrink-0">
                      {done}/{r.steps.length}
                    </Badge>
                  </div>
                  <ul className="space-y-1.5">
                    {r.steps.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        {statusIcon(s.status)}
                        <span
                          className={cn(
                            "truncate",
                            s.status === "done" && "text-muted-foreground line-through decoration-1"
                          )}
                        >
                          {s.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        {runs.length > 0 && (
          <div className="border-t border-border/60 p-3">
            <Button variant="ghost" size="sm" className="w-full" onClick={clearCompleted}>
              <Trash2 className="w-4 h-4 mr-2" /> Clear completed
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
