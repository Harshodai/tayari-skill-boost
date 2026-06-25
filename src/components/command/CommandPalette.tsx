import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  PenLine,
  User as UserIcon,
  Settings,
  Rocket,
  Mic,
  MessagesSquare,
  Map,
  Sun,
  Moon,
  LogOut,
  Sparkles,
  Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useHotkeys } from "./useHotkeys";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  perform: () => void;
  keywords?: string[];
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = (() => {
    try { return useTheme(); } catch { return { theme: "dark" as const, toggleTheme: () => {} }; }
  })();

  // Global shortcuts (palette + jump-to navigation)
  useHotkeys({
    "mod+k": () => setOpen((v) => !v),
    "g d": () => navigate("/dashboard"),
    "g j": () => navigate("/jobs"),
    "g p": () => navigate("/profile"),
    "g r": () => navigate("/resume"),
    "g i": () => navigate("/interview-board"),
    "g s": () => navigate("/settings"),
    "?": () => setOpen(true),
  });

  const go = (path: string) => () => {
    setOpen(false);
    navigate(path);
  };

  const actions: Action[] = useMemo(
    () => [
      { id: "go-dashboard", label: "Go to Dashboard", hint: "g d", icon: LayoutDashboard, group: "Navigate", perform: go("/dashboard") },
      { id: "go-jobs", label: "Smart Job Search", hint: "g j", icon: Briefcase, group: "Navigate", perform: go("/jobs") },
      { id: "go-resume", label: "Resume Optimizer", hint: "g r", icon: FileText, group: "Navigate", perform: go("/resume") },
      { id: "go-cover", label: "Cover Letter", icon: PenLine, group: "Navigate", perform: go("/cover-letter") },
      { id: "go-interview", label: "Interview Board", hint: "g i", icon: Mic, group: "Navigate", perform: go("/interview-board") },
      { id: "go-prep", label: "AI Interview Prep", icon: Mic, group: "Navigate", perform: go("/interview-prep") },
      { id: "go-comms", label: "Communication Hub", icon: MessagesSquare, group: "Navigate", perform: go("/communication") },
      { id: "go-roadmap", label: "Career Roadmap", icon: Map, group: "Navigate", perform: go("/roadmap") },
      { id: "go-profile", label: "Profile", hint: "g p", icon: UserIcon, group: "Navigate", perform: go("/profile") },
      { id: "go-settings", label: "Settings", hint: "g s", icon: Settings, group: "Navigate", perform: go("/settings") },

      { id: "act-tailor", label: "Tailor resume to a job…", icon: Sparkles, group: "AI actions", perform: go("/resume?intent=tailor") },
      { id: "act-cover", label: "Generate a cover letter…", icon: Sparkles, group: "AI actions", perform: go("/cover-letter?intent=new") },
      { id: "act-autopilot", label: "Run AutoPilot apply chain…", icon: Rocket, group: "AI actions", perform: go("/autopilot") },
      { id: "act-search", label: "Search jobs…", icon: Search, group: "AI actions", perform: go("/jobs") },

      {
        id: "theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? Sun : Moon,
        group: "Preferences",
        perform: () => { toggleTheme(); setOpen(false); },
      },
      {
        id: "signout",
        label: "Sign out",
        icon: LogOut,
        group: "Account",
        perform: async () => { setOpen(false); await signOut(); navigate("/"); },
      },
    ],
    [navigate, signOut, theme, toggleTheme],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Action[]>();
    for (const a of actions) {
      if (!m.has(a.group)) m.set(a.group, []);
      m.get(a.group)!.push(a);
    }
    return Array.from(m.entries());
  }, [actions]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search… (⌘K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {grouped.map(([group, items], gi) => (
          <div key={group}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((a) => (
                <CommandItem key={a.id} onSelect={a.perform} value={`${a.group} ${a.label}`}>
                  <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                  {a.hint && <CommandShortcut>{a.hint}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
