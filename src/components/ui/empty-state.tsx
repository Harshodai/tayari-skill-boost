/**
 * EmptyState — Production-grade empty/zero-state component
 *
 * Props/API:
 *  icon        — ReactNode icon/illustration to display
 *  title       — Primary heading text
 *  description — Supporting description text
 *  action      — Optional { label, onClick, href } primary CTA
 *  secondaryAction — Optional secondary CTA
 *  size        — "sm" | "md" | "lg" (default: "md")
 *  className   — Extra Tailwind overrides
 *
 * Variants:
 *  <EmptyState.Jobs />         — No jobs found
 *  <EmptyState.Search />       — No search results
 *  <EmptyState.Applications /> — No applications yet
 *  <EmptyState.Error />        — Error state with retry
 *
 * Usage:
 *  <EmptyState
 *    icon={<BriefcaseIcon />}
 *    title="No jobs found"
 *    description="Try adjusting your filters or search terms."
 *    action={{ label: "Clear filters", onClick: handleClear }}
 *  />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type ActionConfig = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
};

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: ActionConfig;
  secondaryAction?: ActionConfig;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    wrapper: "py-8 px-4",
    iconWrapper: "mb-3 h-10 w-10 rounded-xl",
    icon: "h-5 w-5",
    title: "text-sm font-semibold",
    description: "text-xs mt-1",
    actions: "mt-4 gap-2",
  },
  md: {
    wrapper: "py-12 px-6",
    iconWrapper: "mb-4 h-14 w-14 rounded-2xl",
    icon: "h-7 w-7",
    title: "text-base font-semibold",
    description: "text-sm mt-1.5",
    actions: "mt-6 gap-3",
  },
  lg: {
    wrapper: "py-20 px-8",
    iconWrapper: "mb-6 h-20 w-20 rounded-3xl",
    icon: "h-10 w-10",
    title: "text-xl font-bold",
    description: "text-base mt-2",
    actions: "mt-8 gap-4",
  },
};

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, secondaryAction, size = "md", className, ...props }, ref) => {
    const cfg = sizeConfig[size];

    const renderAction = (cfg_action: ActionConfig, variant: "default" | "outline" = "default") => {
      if (cfg_action.href) {
        return (
          <Button variant={variant} asChild>
            <a href={cfg_action.href}>
              {cfg_action.icon}
              {cfg_action.label}
            </a>
          </Button>
        );
      }
      return (
        <Button variant={variant} onClick={cfg_action.onClick}>
          {cfg_action.icon}
          {cfg_action.label}
        </Button>
      );
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center",
          cfg.wrapper,
          className
        )}
        role="status"
        aria-label={title}
        {...props}
      >
        {icon && (
          <div
            className={cn(
              "flex items-center justify-center bg-muted/60 text-muted-foreground",
              cfg.iconWrapper
            )}
            aria-hidden="true"
          >
            <span className={cfg.icon}>{icon}</span>
          </div>
        )}
        <h3 className={cn("text-foreground", cfg.title)}>{title}</h3>
        {description && (
          <p className={cn("text-muted-foreground max-w-sm", cfg.description)}>{description}</p>
        )}
        {(action || secondaryAction) && (
          <div className={cn("flex flex-wrap items-center justify-center", cfg.actions)}>
            {action && renderAction(action, "default")}
            {secondaryAction && renderAction(secondaryAction, "outline")}
          </div>
        )}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

/* ── Semantic presets ─────────────────────────────────────────── */

EmptyState.displayName = "EmptyState";

/** No jobs found */
const JobsEmptyState = ({
  onClear,
  className,
}: {
  onClear?: () => void;
  className?: string;
}) => (
  <EmptyState
    className={className}
    icon={
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-full w-full">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
      </svg>
    }
    title="No jobs found"
    description="Try adjusting your filters, search terms, or location to discover more opportunities."
    action={onClear ? { label: "Clear filters", onClick: onClear } : undefined}
  />
);

/** No search results */
const SearchEmptyState = ({
  query,
  onReset,
  className,
}: {
  query?: string;
  onReset?: () => void;
  className?: string;
}) => (
  <EmptyState
    className={className}
    icon={
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-full w-full">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    }
    title={query ? `No results for "${query}"` : "No results found"}
    description="We couldn't find what you're looking for. Try different keywords or check your spelling."
    action={onReset ? { label: "Reset search", onClick: onReset } : undefined}
  />
);

/** Error state with retry */
const ErrorEmptyState = ({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) => (
  <EmptyState
    className={className}
    icon={
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-full w-full text-destructive">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    }
    title="Something went wrong"
    description={message ?? "An unexpected error occurred. Please try again."}
    action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}
  />
);

export { EmptyState, JobsEmptyState, SearchEmptyState, ErrorEmptyState };
