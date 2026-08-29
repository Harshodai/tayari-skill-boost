import React, { useEffect, useState } from "react";
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
  FileText,
  Search,
  Zap,
  Bookmark,
  Mail,
  Mic,
  BookOpen,
  Settings,
  User,
  Key,
  CreditCard,
  LogOut,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    const handleCustomOpen = () => setOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("open:command-palette", handleCustomOpen);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open:command-palette", handleCustomOpen);
    };
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search tools..." />
      <CommandList>
        <CommandEmpty>No matching tools or pages found.</CommandEmpty>
        
        <CommandGroup heading="Quick Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/resume"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Resume Optimizer</span>
            <CommandShortcut>⌘R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/jobs"))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Smart Job Search</span>
            <CommandShortcut>⌘J</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/jobs/autopilot"))}>
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            <span>AutoPilot AI Engine</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/pipeline"))}>
            <Bookmark className="mr-2 h-4 w-4" />
            <span>Application Pipeline</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate("/cover-letter"))}>
            <Mail className="mr-2 h-4 w-4" />
            <span>AI Cover Letter Generator</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/knowledge-hub"))}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Knowledge Hub & Flashcards</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/career-ops"))}>
            <Terminal className="mr-2 h-4 w-4 text-cyan-500" />
            <span>Career Ops & Radar</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tools & Generators">
          <CommandItem onSelect={() => runCommand(() => navigate("/typst-studio"))}>
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            <span>Typst Resume Studio</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/answer-bank"))}>
            <Bookmark className="mr-2 h-4 w-4" />
            <span>Candidate Answer Bank</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/one-shot"))}>
            <Zap className="mr-2 h-4 w-4 text-yellow-400" />
            <span>One-Shot Pipeline</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account & Settings">
          <CommandItem onSelect={() => runCommand(() => navigate("/profile"))}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile & Achievements</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Account Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/api-keys"))}>
            <Key className="mr-2 h-4 w-4" />
            <span>API Keys & Integration</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/pricing"))}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Pricing & Subscription</span>
          </CommandItem>
          {user && (
            <CommandItem onSelect={() => runCommand(async () => { await signOut(); navigate("/"); })}>
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">Sign Out</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
