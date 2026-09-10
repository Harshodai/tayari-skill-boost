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
  Users,
  TrendingUp,
  Bot,
  ClipboardCheck,
  KanbanSquare,
  PenTool,
  MessageSquareText,
  Globe,
  Send,
  Radar,
  Handshake,
  BarChart3,
  Target,
  Map,
  ShieldCheck,
  Coins,
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
import { CapabilityStatusBadge, type CapabilityStatusType } from "@/components/common/CapabilityStatusBadge";
import type { LucideIcon } from "lucide-react";

type Item = { title: string; url: string; icon: LucideIcon | React.ComponentType<{ className?: string }>; enabled?: boolean; status?: CapabilityStatusType };
type Group = { label: string; items: Item[] };

/** The core career workflow items that anchor the primary candidate journey. */
const primaryItems = (): Item[] => [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard, enabled: true, status: "ready" },
  { title: "Find jobs", url: "/jobs", icon: Search, enabled: features.jobSearch, status: "ready" },
  { title: "My resume", url: "/resume", icon: FileText, enabled: features.resumeOptimizer, status: "ready" },
  { title: "Review queue", url: "/review-queue", icon: ClipboardCheck, enabled: true, status: "review_required" },
  { title: "Applications", url: "/applications", icon: KanbanSquare, enabled: true, status: "ready" },
];

/**
 * Structured capability hierarchy separating Core Tools, Advanced Tools,
 * Integrations, Experimental, and Account management.
 */
const moreGroups = (): Group[] => [
  {
    label: "Core Tools",
    items: [
      { title: "Saved jobs", url: "/pipeline", icon: Bookmark, enabled: features.jobSearch, status: "ready" },
      { title: "Resume studio", url: "/typst-studio", icon: PenTool, enabled: features.resumeOptimizer, status: "ready" },
      { title: "Cover letters", url: "/cover-letter", icon: Mail, enabled: features.coverLetter, status: "ready" },
      { title: "Answer bank", url: "/answer-bank", icon: MessageSquareText, enabled: true, status: "ready" },
      { title: "Interview board", url: "/interview-board", icon: KanbanSquare, enabled: true, status: "ready" },
    ],
  },
  {
    label: "Advanced Tools",
    items: [
      { title: "AutoPilot", url: "/jobs/autopilot", icon: Zap, enabled: features.jobSearch, status: "manual_handoff" },
      { title: "Company radar", url: "/radar", icon: Radar, enabled: true, status: "ready" },
      { title: "Negotiation", url: "/negotiation", icon: Handshake, enabled: true, status: "ready" },
      { title: "Skill gaps", url: "/skill-gap-radar", icon: Target, enabled: true, status: "ready" },
      { title: "Career roadmap", url: "/roadmap", icon: Map, enabled: features.careerRoadmap, status: "ready" },
      { title: "Career radar", url: "/career-ops", icon: Terminal, enabled: features.careerOps, status: "ready" },
      { title: "Knowledge hub", url: "/knowledge-hub", icon: BookOpen, enabled: features.knowledgeHub, status: "ready" },
      { title: "Outcomes", url: "/outcomes", icon: TrendingUp, enabled: true, status: "ready" },
      { title: "Funnel analytics", url: "/analytics-funnel", icon: BarChart3, enabled: true, status: "ready" },
      { title: "Portfolio", url: "/portfolio", icon: Globe, enabled: true, status: "ready" },
      { title: "Networking", url: "/networking", icon: Users, enabled: true, status: "ready" },
      { title: "Recruiter outreach", url: "/outreach", icon: Send, enabled: true, status: "ready" },
      { title: "Agent questions", url: "/questions", icon: HelpCircle, enabled: features.jobSearch, status: "ready" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { title: "OmniSave", url: "/omnisave", icon: BookOpen, enabled: true, status: "ready" },
      { title: "LinkedIn import", url: "/linkedin-import", icon: Linkedin, enabled: true, status: "beta" },
      { title: "Browser extension", url: "/extension/onboarding", icon: Globe, enabled: features.browserExtension, status: "ready" },
      { title: "Desktop agent", url: "/desktop", icon: Terminal, enabled: features.desktopAgent, status: "beta" },
    ],
  },
  {
    label: "Experimental & Beta",
    items: [
      { title: "Apply agent", url: "/apply-agent", icon: Bot, enabled: features.applyAgent, status: "beta" },
      { title: "Computer control", url: "/control-room", icon: Terminal, enabled: features.computerControl, status: "manual_handoff" },
      { title: "Voice coach", url: "/interview-coach", icon: Mic, enabled: features.voiceCoach, status: "beta" },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Credits", url: "/credits", icon: Coins, enabled: true, status: "ready" },
      { title: "Privacy check", url: "/privacy-diagnostics", icon: ShieldCheck, enabled: true, status: "ready" },
      { title: "API keys", url: "/api-keys", icon: Key, enabled: true, status: "ready" },
      { title: "Help", url: "/help", icon: HelpCircle, enabled: features.help, status: "ready" },
    ],
  },
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
  const groups = moreGroups()
    .map((g) => ({ ...g, items: g.items.filter((i) => i.enabled !== false) }))
    .filter((g) => g.items.length > 0);
  const [moreOpen, setMoreOpen] = useState(() =>
    groups.some((g) => g.items.some((i) => isActive(i.url)))
  );

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
                      {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                      {!collapsed && item.status && (
                        <CapabilityStatusBadge status={item.status} size="sm" showIcon={false} />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {groups.length > 0 && (
          <>
            {!collapsed && (
              <SidebarGroup className="py-0">
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
              </SidebarGroup>
            )}
            {(moreOpen || collapsed) &&
              groups.map((group) => (
                <SidebarGroup key={group.label} className="py-1">
                  {!collapsed && (
                    <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/55">
                      {group.label}
                    </SidebarGroupLabel>
                  )}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                            <NavLink to={item.url} className={({ isActive: a }) => linkClass(a)}>
                              <item.icon className="h-4 w-4 shrink-0" />
                              {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                              {!collapsed && item.status && (
                                <CapabilityStatusBadge status={item.status} size="sm" showIcon={false} />
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
          </>
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
