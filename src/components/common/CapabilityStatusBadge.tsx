import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Key,
  HandMetal,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CapabilityStatusType =
  | "ready"
  | "beta"
  | "review_required"
  | "provider_required"
  | "manual_handoff"
  | "coming_soon";

interface CapabilityStatusConfig {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  className: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const CAPABILITY_STATUS_CONFIG: Record<CapabilityStatusType, CapabilityStatusConfig> = {
  ready: {
    label: "Ready",
    variant: "default",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
    icon: CheckCircle2,
    description: "Production-ready and fully operational with deterministic guardrails.",
  },
  beta: {
    label: "Beta",
    variant: "secondary",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/25",
    icon: Sparkles,
    description: "Functional workflow under active enhancement. User verification recommended.",
  },
  review_required: {
    // ponytail: was "Review required" — read like a live pending-count alert
    // next to an empty queue (confirmed via a real-user pass). This is a
    // permanent policy label (every submission always needs human review by
    // design, see CLAUDE.md's manual-submit-only contract), not a count, so
    // the label now says so directly instead of reading like one.
    label: "Always reviewed",
    variant: "outline",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
    icon: AlertCircle,
    description: "Every submission requires your explicit review and approval before anything is sent — this is a permanent safety policy, not a count of pending items.",
  },
  provider_required: {
    label: "Provider required",
    variant: "outline",
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/25",
    icon: Key,
    description: "Requires connected API credentials or third-party service authorization.",
  },
  manual_handoff: {
    label: "Manual handoff",
    variant: "outline",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/25",
    icon: HandMetal,
    description: "Autonomous execution is blocked by policy. Prepares materials then hands off to candidate.",
  },
  coming_soon: {
    label: "Coming soon",
    variant: "outline",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
    icon: Clock,
    description: "Scaffolded in architecture and scheduled for subsequent release.",
  },
};

interface CapabilityStatusBadgeProps {
  status: CapabilityStatusType;
  customExplanation?: string;
  size?: "sm" | "default";
  showIcon?: boolean;
}

export const CapabilityStatusBadge: React.FC<CapabilityStatusBadgeProps> = ({
  status,
  customExplanation,
  size = "default",
  showIcon = true,
}) => {
  const config = CAPABILITY_STATUS_CONFIG[status] || CAPABILITY_STATUS_CONFIG.beta;
  const Icon = config.icon;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            role="button"
            aria-label={config.label}
            className="inline-flex cursor-help"
          >
            <Badge
              variant={config.variant}
              className={cn(
                "inline-flex items-center gap-1 font-medium transition-colors",
                size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
                config.className
              )}
            >
              {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
              <span>{config.label}</span>
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-semibold mb-1">{config.label}</p>
          <p className="text-muted-foreground">{customExplanation || config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
