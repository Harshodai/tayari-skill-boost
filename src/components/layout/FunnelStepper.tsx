import React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FunnelStep {
  id: string;
  name: string;
  href: string;
}

export const FUNNEL_STEPS: FunnelStep[] = [
  { id: "resume", name: "1. Resume", href: "/resume" },
  { id: "fit", name: "2. Fit Analysis", href: "/jobs" },
  { id: "tailor", name: "3. Tailor", href: "/one-shot" },
  { id: "review", name: "4. Review", href: "/review-queue" },
  { id: "track", name: "5. Track", href: "/pipeline" },
  { id: "interview", name: "6. Interview Prep", href: "/interview" },
];

interface FunnelStepperProps {
  currentStepId: string;
  completedStepIds?: string[];
  className?: string;
}

export const FunnelStepper: React.FC<FunnelStepperProps> = ({
  currentStepId,
  completedStepIds = [],
  className = "",
}) => {
  return (
    <nav
      aria-label="Application Lifecycle Progress"
      className={cn("w-full py-3 mb-6 border-b border-border/40 bg-card/30 backdrop-blur rounded-xl", className)}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between overflow-x-auto gap-2 text-xs">
        {FUNNEL_STEPS.map((step, idx) => {
          const isCurrent = step.id === currentStepId;
          const isCompleted = completedStepIds.includes(step.id);

          return (
            <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
              <a
                href={step.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : isCompleted
                    ? "bg-muted text-foreground hover:bg-muted/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Circle className={`w-3.5 h-3.5 ${isCurrent ? "fill-primary-foreground" : "fill-none"}`} />
                )}
                <span>{step.name}</span>
              </a>
              {idx < FUNNEL_STEPS.length - 1 && (
                <div className="w-4 h-[1px] bg-border flex-shrink-0 hidden sm:block" />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
