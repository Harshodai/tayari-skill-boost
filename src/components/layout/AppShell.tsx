import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ActivityButton } from "@/components/automation/ActivityButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useAutomation } from "@/contexts/AutomationContext";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { CommandPalette } from "@/components/command/CommandPalette";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const { user, signOut } = useAuth();
  const { runs, open } = useAutomation();
  const navigate = useNavigate();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const activeRuns = runs.filter((r) => r.steps.some((s) => s.status === "running" || s.status === "queued"));
  const hasActive = activeRuns.length > 0;
  const currentRun = activeRuns[0];
  let currentStep = null;
  let progressPct = 0;
  if (currentRun) {
    const totalSteps = currentRun.steps.length;
    const completedSteps = currentRun.steps.filter((s) => s.status === "done" || s.status === "failed").length;
    currentStep = currentRun.steps.find((s) => s.status === "running" || s.status === "queued");
    progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  }

  return (
    <SidebarProvider>
      <SkipToContent />
      <CommandPalette />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b border-border/60 bg-background/85 backdrop-blur px-3 md:px-5">
            <SidebarTrigger />
            <div className="flex-1 min-w-0">
              {title && (
                <h1 className="text-sm md:text-base font-semibold tracking-tight truncate">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate hidden md:block">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex h-8 gap-2 text-xs text-muted-foreground"
                onClick={() => {
                  // Simulate ⌘K
                  const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                  window.dispatchEvent(ev);
                }}
                aria-label="Open command palette"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search or jump…</span>
                <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
              </Button>
              {actions}
              <NotificationsBell />
              <ActivityButton />
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <Avatar className="h-8 w-8 border border-border/60">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs">
                    <div className="font-medium truncate">{displayName}</div>
                    <div className="text-muted-foreground truncate">{user?.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <UserIcon className="h-4 w-4 mr-2" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <SettingsIcon className="h-4 w-4 mr-2" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate("/");
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {hasActive && currentRun && (
            <div className="bg-primary/5 border-b border-border/60 py-1.5 px-3 md:px-5 flex items-center justify-between text-xs font-medium animate-fade-in flex-shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-muted-foreground font-semibold">Apply Assist:</span>
                <span className="truncate max-w-[200px] md:max-w-xs">{currentRun.title}</span>
                {currentStep && (
                  <>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="text-muted-foreground truncate">{currentStep.label}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-20 md:w-32">
                  <Progress value={progressPct} size="xs" colorScheme="primary" />
                </div>
                <span className="text-muted-foreground">{progressPct}%</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={open} 
                  className="h-6 text-[10px] text-primary hover:text-primary hover:bg-primary/10 px-2"
                >
                  View Details
                </Button>
              </div>
            </div>
          )}

          <main id="main-content" className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
