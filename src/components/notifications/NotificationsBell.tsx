import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/api";
import { useAuth } from "@/contexts/AuthContext";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  channel: string;
  read: boolean;
  data?: Record<string, any>;
  created_at: string;
}

const NOTIFICATIONS_POLL_MS = 20000;

export function NotificationsBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch<NotificationItem[]>("/v1/notifications");
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch {
      // Degrade gracefully if backend is offline or unauthorized
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
    const timer = setInterval(fetchNotifications, NOTIFICATIONS_POLL_MS);
    return () => clearInterval(timer);
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await apiFetch(`/v1/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Ignore transient errors
    }
  };

  const markAllAsRead = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await apiFetch("/v1/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Fallback: try marking each unread sequentially
      const unreadList = notifications.filter((n) => !n.read);
      await Promise.all(
        unreadList.map((n) =>
          apiFetch(`/v1/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => null)
        )
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-9 w-9 rounded-full hover:bg-muted/80", className)}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-0 shadow-xl rounded-xl border border-border/60">
        <DropdownMenuLabel className="flex items-center justify-between p-3.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={markingAll}
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {markingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 text-primary" />
              )}
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/20">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="text-muted-foreground mt-0.5">We'll alert you when job watches find matches or approvals update.</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.read) markAsRead(item.id);
                }}
                className={cn(
                  "p-3.5 text-xs transition-colors cursor-pointer hover:bg-muted/50 flex items-start gap-3",
                  !item.read && "bg-primary/[0.04]"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {!item.read ? (
                    <span className="block h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <span className="block h-2 w-2 rounded-full bg-transparent" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("font-medium leading-tight", !item.read ? "text-foreground font-semibold" : "text-muted-foreground")}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTimestamp(item.created_at)}
                    </span>
                  </div>
                  {item.body && (
                    <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">
                      {item.body}
                    </p>
                  )}
                  {item.data?.match_count && (
                    <div className="pt-1">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {item.data.match_count} match{item.data.match_count === 1 ? "" : "es"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationsBell;
