/**
 * StatsCard — KPI / metric card with trend indicators
 *
 * Props/API:
 *  label       — Metric label
 *  value       — Numeric or string value
 *  trend       — { value: number; direction: "up"|"down"|"neutral"; label?: string }
 *  icon        — ReactNode icon
 *  isLoading   — Show skeleton state
 *  colorScheme — "default" | "primary" | "success" | "warning" | "destructive"
 *  description — Extra context text below value
 *  className   — Extra Tailwind overrides
 *
 * Usage:
 *  <StatsCard
 *    label="ATS Score"
 *    value="87%"
 *    trend={{ value: 12, direction: "up", label: "vs last week" }}
 *    icon={<ChartBarIcon />}
 *    colorScheme="success"
 *  />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

type TrendDirection = "up" | "down" | "neutral";

interface Trend {
  value: number;
  direction: TrendDirection;
  label?: string;
}

type ColorScheme = "default" | "primary" | "success" | "warning" | "destructive";

export interface StatsCardProps {
  label: string;
  value: string | number;
  trend?: Trend;
  icon?: React.ReactNode;
  isLoading?: boolean;
  colorScheme?: ColorScheme;
  description?: string;
  className?: string;
}

const colorConfig: Record<
  ColorScheme,
  { iconBg: string; iconColor: string; glow: string }
> = {
  default: {
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    glow: "",
  },
  primary: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    glow: "ring-1 ring-primary/10",
  },
  success: {
    iconBg: "bg-success/10",
    iconColor: "text-success",
    glow: "ring-1 ring-success/10",
  },
  warning: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    glow: "ring-1 ring-warning/10",
  },
  destructive: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    glow: "ring-1 ring-destructive/10",
  },
};

const trendConfig: Record<TrendDirection, { cls: string; icon: React.ReactNode }> = {
  up: {
    cls: "text-success",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.519l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941" />
      </svg>
    ),
  },
  down: {
    cls: "text-destructive",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
      </svg>
    ),
  },
  neutral: {
    cls: "text-muted-foreground",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    ),
  },
};

function StatsCard({
  label,
  value,
  trend,
  icon,
  isLoading,
  colorScheme = "default",
  description,
  className,
}: StatsCardProps) {
  const colors = colorConfig[colorScheme];

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-card p-5",
          className
        )}
        aria-busy="true"
        aria-label="Loading metric"
      >
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="mt-4 h-8 w-20" />
        <Skeleton className="mt-2 h-3 w-32" />
      </div>
    );
  }

  const trendDef = trend ? trendConfig[trend.direction] : null;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border/50 bg-card p-5",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        colors.glow,
        className
      )}
      role="region"
      aria-label={`${label}: ${value}${trend ? `, ${trend.direction === "up" ? "up" : trend.direction === "down" ? "down" : "unchanged"} ${trend.value}%` : ""}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              colors.iconBg,
              colors.iconColor
            )}
            aria-hidden="true"
          >
            <span className="h-5 w-5">{icon}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
      </div>

      {/* Trend + Description */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {trendDef && trend && (
          <span
            className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", trendDef.cls)}
            aria-label={`${trend.direction === "up" ? "Increased" : trend.direction === "down" ? "Decreased" : "Unchanged"} by ${trend.value}%`}
          >
            {trendDef.icon}
            {trend.value}%
          </span>
        )}
        {(trend?.label ?? description) && (
          <span className="text-xs text-muted-foreground">
            {trend?.label ?? description}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * StatsGrid — Responsive grid wrapper for StatsCards
 *
 * Usage:
 *  <StatsGrid>
 *    <StatsCard label="Applications" value={42} ... />
 *    <StatsCard label="Interviews" value={7} ... />
 *  </StatsGrid>
 */
function StatsGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const colsCls = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", colsCls[columns], className)}>
      {children}
    </div>
  );
}

export { StatsCard, StatsGrid };
