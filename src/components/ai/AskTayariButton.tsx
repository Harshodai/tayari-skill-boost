import { useState, type ElementType } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bot,
  Compass,
  ExternalLink,
  FileText,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Placement = "header" | "floating";

type Action = {
  label: string;
  icon: ElementType;
  hint: string;
  to: string;
};

const PAGE_ACTIONS: Record<string, Action[]> = {
  "/jobs": [
    { label: "Review this job fit", icon: Target, hint: "Compare a role with your current profile", to: "/jobs?assistant=fit-review" },
    { label: "Prepare a tailored draft", icon: FileText, hint: "Start a reviewable application artefact", to: "/jobs?assistant=tailor" },
    { label: "Plan interview practice", icon: MessageSquare, hint: "Turn this role into preparation steps", to: "/jobs?assistant=interview-plan" },
  ],
  "/resume": [
    { label: "Tailor to a job", icon: Target, hint: "Optimise your resume for a specific JD", to: "/resume?assistant=tailor" },
    { label: "Review weakest bullet", icon: Sparkles, hint: "Improve impact without inventing facts", to: "/resume?assistant=bullet-review" },
  ],
  "/pipeline": [
    { label: "Suggest next action", icon: Compass, hint: "Prioritise the next candidate-owned step", to: "/pipeline?assistant=next-action" },
  ],
};

const DEFAULT_ACTIONS: Action[] = [
  { label: "Plan my next step", icon: Compass, hint: "Open your career plan and current priorities", to: "/dashboard?assistant=next-step" },
  { label: "Find matching jobs", icon: Target, hint: "Review fresh opportunities against your profile", to: "/jobs?assistant=fresh-matches" },
  { label: "Prepare outreach", icon: MessageSquare, hint: "Draft a recruiter or referral message for review", to: "/agent-reach?assistant=outreach" },
];

interface AskTayariButtonProps {
  placement?: Placement;
}

/**
 * Candidate-facing entry point for TA. It deliberately routes to existing product
 * surfaces and does not imply that an external action has been performed.
 */
export function AskTayariButton({ placement = "floating" }: AskTayariButtonProps) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const actions =
    Object.entries(PAGE_ACTIONS).find(([path]) => pathname.startsWith(path))?.[1] ?? DEFAULT_ACTIONS;

  const activate = (action: Action) => {
    setOpen(false);
    navigate(action.to);
  };

  const isHeader = placement === "header";

  return (
    <>
      {isHeader ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          data-testid="tayari-assistant-header"
          aria-label="Open Tayari AI, your personalised career co-pilot"
          className="hidden md:inline-flex h-8 gap-2 border-primary/30 bg-primary/5 px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Bot className="h-3.5 w-3.5" />
          <span className="font-semibold">Tayari AI</span>
          <span className="hidden lg:inline text-primary/70">Career co-pilot</span>
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="tayari-assistant-mobile"
          aria-label="Open Tayari AI, your personalised career co-pilot"
          className={cn(
            "fixed z-40 right-4 bottom-20 h-12 w-12 rounded-full md:hidden",
            "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg",
            "flex items-center justify-center hover:scale-105 transition-transform",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "ring-1 ring-primary/30"
          )}
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md" aria-describedby="tayari-assistant-boundary">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> Tayari AI
            </SheetTitle>
            <SheetDescription>
              Your personalised career co-pilot for the work you are doing now.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground" id="tayari-assistant-boundary">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Candidate-controlled by design
            </div>
            TA can prepare, organise, and route work using your saved profile. You review sensitive answers and application materials. A portal submission is only shown as verified when a receipt is recorded.
          </div>

          <div className="mt-5 space-y-2" aria-label="Suggested Tayari actions">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  type="button"
                  key={action.label}
                  onClick={() => activate(action)}
                  className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors flex items-start gap-3"
                >
                  <span className="mt-0.5 h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{action.label}</span>
                    <span className="block text-xs text-muted-foreground">{action.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5 w-full justify-between"
            onClick={() => {
              setOpen(false);
              navigate("/agents");
            }}
          >
            View agent work and evidence <ExternalLink className="h-3.5 w-3.5" />
          </Button>

          <p className="text-[11px] text-muted-foreground mt-6">
            Tip: press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">⌘K</kbd> for the full command palette.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
