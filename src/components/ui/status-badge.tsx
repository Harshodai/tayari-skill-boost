/**
 * StatusBadge — Rich, semantic status indicator component
 *
 * Props/API:
 *  status    — "applied" | "interview" | "offer" | "rejected" | "saved" | "screening" | "pending" | "active" | "paused" | "completed"
 *  size      — "sm" | "md" | "lg"  (default: "md")
 *  dot       — Show pulsing status dot (default: false for most, true for "active")
 *  label     — Override display text
 *  className — Extra Tailwind overrides
 *
 * Usage:
 *  <StatusBadge status="interview" />
 *  <StatusBadge status="active" dot />
 *  <StatusBadge status="offer" size="lg" />
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type ApplicationStatus =
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "saved"
  | "screening"
  | "pending"
  | "active"
  | "paused"
  | "completed"
  | "draft";

const statusConfig: Record<
  ApplicationStatus,
  { label: string; className: string; dotColor: string; dot?: boolean }
> = {
  applied: {
    label: "Applied",
    // info = blue token (separate from primary indigo)
    className: "bg-info/10 text-info border-info/20",
    dotColor: "bg-info",
  },
  screening: {
    label: "Screening",
    className: "bg-warning/10 text-warning border-warning/20",
    dotColor: "bg-warning",
    dot: true,
  },
  interview: {
    // Use primary/indigo for interview — it's the highest-signal active state
    label: "Interview",
    className: "bg-primary/10 text-primary border-primary/20",
    dotColor: "bg-primary",
    dot: true,
  },
  offer: {
    label: "Offer 🎉",
    className: "bg-success/10 text-success border-success/20",
    dotColor: "bg-success",
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    dotColor: "bg-destructive",
  },
  saved: {
    label: "Saved",
    className: "bg-muted/60 text-muted-foreground border-border",
    dotColor: "bg-muted-foreground",
  },
  pending: {
    label: "Pending",
    className: "bg-warning/10 text-warning border-warning/20",
    dotColor: "bg-warning",
  },
  active: {
    label: "Active",
    className: "bg-success/10 text-success border-success/20",
    dotColor: "bg-success",
    dot: true,
  },
  paused: {
    label: "Paused",
    className: "bg-muted/60 text-muted-foreground border-border",
    dotColor: "bg-muted-foreground",
  },
  completed: {
    label: "Completed",
    className: "bg-success/10 text-success border-success/20",
    dotColor: "bg-success",
  },
  draft: {
    label: "Draft",
    className: "bg-muted/40 text-muted-foreground border-border/50",
    dotColor: "bg-muted-foreground",
  },
};

const sizeCls = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
  lg: "px-3 py-1.5 text-sm gap-2",
};

const dotSizeCls = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
};

export interface StatusBadgeProps {
  status: ApplicationStatus;
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  label?: string;
  className?: string;
}

function StatusBadge({ status, size = "md", dot, label, className }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  const showDot = dot ?? cfg.dot ?? false;

  return (
    <span
      role="status"
      aria-label={`Status: ${label ?? cfg.label}`}
      className={cn(
        "inline-flex items-center font-medium rounded-full border select-none",
        sizeCls[size],
        cfg.className,
        className
      )}
    >
      {showDot && (
        <span className={cn("relative flex shrink-0", dotSizeCls[size])} aria-hidden="true">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              cfg.dotColor
            )}
          />
          <span className={cn("relative inline-flex rounded-full h-full w-full", cfg.dotColor)} />
        </span>
      )}
      {label ?? cfg.label}
    </span>
  );
}

/**
 * AtsScoreBadge — Semantic color-coded ATS score badge
 *
 * Props/API:
 *  score     — 0–100 numeric ATS score
 *  size      — "sm" | "md" | "lg"
 *  showLabel — Whether to append "ATS" label text
 *
 * Usage:
 *  <AtsScoreBadge score={87} />
 *  <AtsScoreBadge score={45} size="sm" />
 */
export interface AtsScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function AtsScoreBadge({ score, size = "md", showLabel = true, className }: AtsScoreBadgeProps) {
  const clampedScore = Math.min(100, Math.max(0, score));

  // Uses design system tokens — adapts to light/dark automatically
  const colorCls =
    clampedScore >= 80
      ? "bg-success/10 text-success border-success/20"
      : clampedScore >= 60
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-destructive/10 text-destructive border-destructive/20";

  return (
    <span
      aria-label={`ATS score: ${clampedScore} out of 100`}
      className={cn(
        "inline-flex items-center font-semibold rounded-full border tabular-nums",
        sizeCls[size],
        colorCls,
        className
      )}
    >
      {clampedScore}
      {showLabel && <span className="font-normal opacity-60 ml-0.5">%</span>}
    </span>
  );
}

export { StatusBadge, AtsScoreBadge };
