import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  FileText,
  Search,
  Bookmark,
  Mail,
  Mic,
  BookOpen,
  Settings,
  HelpCircle,
  Key,
  Linkedin,
  LogOut,
  Terminal,
  ChevronDown,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { features } from "@/config/features";
import { cn } from "@/lib/utils";

type Item = { title: string; url: string; icon: any; enabled?: boolean };

/** The five things that make the product work. Everything else lives under "More". */
const primaryItems = (): Item[] => [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard, enabled: true },
  { title: "Find jobs", url: "/jobs", icon: Search, enabled: features.jobSearch },
  { title: "My resume", url: "/resume", icon: FileText, enabled: features.resumeOptimizer },
  { title: "Applications", url: "/pipeline", icon: Bookmark, enabled: features.jobSearch },
  { title: "Interviews", url: "/interview/prep", icon: Mic, enabled: features.interviewAI },
];

const moreItems = (): Item[] => [
  { title: "AutoPilot", url: "/jobs/autopilot", icon: Zap, enabled: features.jobSearch },
  { title: "Cover letters", url: "/cover-letter", icon: Mail, enabled: features.coverLetter },
  { title: "Knowledge hub", url: "/knowledge-hub", icon: BookOpen, enabled: features.knowledgeHub },
  { title: "Career radar", url: "/career-ops", icon: Terminal, enabled: features.careerOps },
  { title: "LinkedIn import", url: "/linkedin-import", icon: Linkedin, enabled: true },
  { title: "API keys", url: "/api-keys", icon: Key, enabled: true },
  { title: "Help", url: "/help", icon: HelpCircle, enabled: features.help },
];

const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
    active
      ? "bg-primary/15 text-primary border border-primary/25 shadow-xs font-semibold"
      : "text-foreground/75 hover:bg-muted/70 hover:text-foreground hover:translate-x-0.5"
  );

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const primary = primaryItems().filter((i) => i.enabled !== false);
  const more = moreItems().filter((i) => i.enabled !== false);
  const [moreOpen, setMoreOpen] = useState(() => more.some((i) => isActive(i.url)));

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="border-b border-border/60 px-3 py-3">
        <Logo showText={!collapsed} />
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} className={({ isActive: a }) => linkClass(a)}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {more.length > 0 && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel asChild>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className="flex w-full items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
                >
                  <span>More tools</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
                </button>
              </SidebarGroupLabel>
            )}
            {(moreOpen || collapsed) && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {more.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <NavLink to={item.url} className={({ isActive: a }) => linkClass(a)}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-2 space-y-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/profile")} tooltip="Profile">
              <NavLink to="/profile" className={({ isActive: a }) => linkClass(a)}>
                <User className="h-4 w-4" />
                {!collapsed && <span>Profile</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Settings">
              <NavLink to="/settings" className={({ isActive: a }) => linkClass(a)}>
                <Settings className="h-4 w-4" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              tooltip="Sign out"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <div className="pt-1 flex justify-end">
            <ThemeToggle />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
