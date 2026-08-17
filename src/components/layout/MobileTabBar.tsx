import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Search, FileText, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Search },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/pipeline", label: "Applied", icon: Bookmark },
];


export function MobileTabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-1"
    >
      <ul className="grid grid-cols-4 h-14 items-center">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to} className="flex justify-center">
              <NavLink
                to={to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-all duration-200 ease-out rounded-xl",
                  active
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                <Icon className={cn("h-4.5 w-4.5", active && "stroke-[2.5]")} />
                <span>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
