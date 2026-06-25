import { useMemo } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAutomation } from "@/contexts/AutomationContext";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  // AutomationContext exposes a list of runs; fall back gracefully if not mounted.
  const ctx = (() => {
    try { return useAutomation(); } catch { return null; }
  })();

  const runs = (ctx as any)?.runs ?? [];
  const items = useMemo(() => {
    return runs
      .slice(0, 8)
      .map((r: any) => ({
        id: r.id,
        title: r.title || r.label || r.current_step || "Automation run",
        status: r.status || "running",
        at: r.updated_at || r.created_at,
      }));
  }, [runs]);

  const unread = items.filter((i: any) => i.status === "completed" || i.status === "done").length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <span className="text-xs font-normal text-muted-foreground">{items.length} recent</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            You're all caught up.
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((it: any) => (
              <li key={it.id} className="px-3 py-2 text-xs hover:bg-muted/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{it.title}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] capitalize",
                      it.status === "completed" || it.status === "done"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : it.status === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {it.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
