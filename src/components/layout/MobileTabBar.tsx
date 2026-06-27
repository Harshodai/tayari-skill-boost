import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Search, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Search },
  { to: "/pipeline", label: "Apply", icon: Send },
  { to: "/profile", label: "Profile", icon: User },
];

export function MobileTabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 h-full">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to} className="flex">
              <NavLink
                to={to}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                <span>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
