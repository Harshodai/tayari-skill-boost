import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, FileText, MessageSquare, Target, Compass } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = { label: string; icon: React.ElementType; hint: string };

const PAGE_ACTIONS: Record<string, Action[]> = {
  "/jobs": [
    { label: "Why is this a fit?", icon: Target, hint: "Score current job vs your profile" },
    { label: "Generate cover letter", icon: FileText, hint: "Draft a tailored letter" },
    { label: "Practice interview", icon: MessageSquare, hint: "Spin up a mock interview" },
  ],
  "/resume": [
    { label: "Tailor to a job", icon: Target, hint: "Optimize for a specific JD" },
    { label: "Rewrite weakest bullet", icon: Sparkles, hint: "Boost impact + metrics" },
  ],
  "/pipeline": [
    { label: "Suggest next action", icon: Compass, hint: "What to do on each application" },
  ],
};

const DEFAULT_ACTIONS: Action[] = [
  { label: "What should I do next?", icon: Compass, hint: "Personalized next step" },
  { label: "Find me jobs", icon: Target, hint: "Surface fresh matches" },
  { label: "Draft an outreach message", icon: MessageSquare, hint: "Recruiter or referral" },
];

export function AskTayariButton() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const actions =
    Object.entries(PAGE_ACTIONS).find(([k]) => pathname.startsWith(k))?.[1] ?? DEFAULT_ACTIONS;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Tayari"
        className={cn(
          "fixed z-40 right-4 bottom-20 md:bottom-6 h-12 w-12 rounded-full",
          "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg",
          "flex items-center justify-center hover:scale-105 transition-transform",
          "ring-1 ring-primary/30"
        )}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Ask Tayari
            </SheetTitle>
            <SheetDescription>
              Quick AI actions for this page.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  onClick={() => setOpen(false)}
                  className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-accent/40 transition-colors flex items-start gap-3"
                >
                  <span className="mt-0.5 h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block text-xs text-muted-foreground">{a.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground mt-6">
            Tip: press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">⌘K</kbd> for the full command palette.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
