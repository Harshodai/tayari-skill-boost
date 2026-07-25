import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  FileText,
  Search,
  Zap,
  Bookmark,
  Mail,
  MessageSquare,
  Mic,
  Map,
  BookOpen,
  Settings,
  HelpCircle,
  Key,
  Linkedin,
  LogOut,
  Users,
  Terminal,
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

const buildGroups = () => [
  {
    label: "Discover",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, enabled: true },
      { title: "Smart Search", url: "/jobs", icon: Search, enabled: features.jobSearch },
      { title: "Career Radar", url: "/career-ops", icon: Terminal, enabled: features.careerOps },
    ] as Item[],
  },
  {
    label: "Prepare",
    items: [
      { title: "Resume Optimizer", url: "/resume", icon: FileText, enabled: features.resumeOptimizer },
      { title: "Cover Letters", url: "/cover-letter", icon: Mail, enabled: features.coverLetter },
      { title: "Knowledge Hub", url: "/knowledge-hub", icon: BookOpen, enabled: features.knowledgeHub },
      { title: "Interview Prep", url: "/interview/prep", icon: Mic, enabled: features.interviewAI },
    ] as Item[],
  },
  {
    label: "Apply & Track",
    items: [
      { title: "Interview Board", url: "/interview", icon: Bookmark, enabled: features.interviewPrep },
      { title: "Pipeline", url: "/pipeline", icon: LayoutDashboard, enabled: features.jobSearch },
      { title: "Apply Assist", url: "/jobs/autopilot", icon: Zap, enabled: features.jobSearch },
    ] as Item[],
  },
  {
    label: "Settings",
    items: [
      { title: "Profile", url: "/profile", icon: User, enabled: true },
      { title: "Settings & API Keys", url: "/settings", icon: Settings, enabled: true },
    ] as Item[],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");
  const groups = buildGroups();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="border-b border-border/60 px-3 py-3">
        <Logo showText={!collapsed} />
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70">{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.filter((i) => i.enabled !== false).map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={({ isActive: a }) =>
                          cn(
                            "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                            a
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-2 space-y-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="LinkedIn Import">
              <NavLink to="/linkedin-import" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                <Linkedin className="h-4 w-4" />
                {!collapsed && <span>LinkedIn</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="API Keys">
              <NavLink to="/api-keys" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                <Key className="h-4 w-4" />
                {!collapsed && <span>API Keys</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <NavLink to="/settings" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                <Settings className="h-4 w-4" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {features.help && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Help">
                <NavLink to="/help" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                  <HelpCircle className="h-4 w-4" />
                  {!collapsed && <span>Help</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={async () => { await signOut(); navigate("/"); }} tooltip="Sign out">
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
