/**
 * LoadingSpinner — Production-grade animated spinner
 *
 * Props/API:
 *  size      — "xs" | "sm" | "md" | "lg" | "xl"  (default: "md")
 *  variant   — "primary" | "secondary" | "white" | "success" | "destructive"
 *  label     — Accessible screen-reader label (default: "Loading…")
 *  className — Extra Tailwind overrides
 *
 * Usage:
 *  <LoadingSpinner />
 *  <LoadingSpinner size="lg" variant="white" label="Submitting form" />
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin rounded-full border-2 border-solid border-current border-r-transparent", {
  variants: {
    size: {
      xs: "h-3 w-3 border-[1.5px]",
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-7 w-7 border-[3px]",
      xl: "h-10 w-10 border-4",
    },
    variant: {
      primary: "text-primary",
      secondary: "text-muted-foreground",
      white: "text-primary-foreground",
      success: "text-green-500",
      destructive: "text-destructive",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "primary",
  },
});

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

const LoadingSpinner = React.forwardRef<HTMLSpanElement, LoadingSpinnerProps>(
  ({ className, size, variant, label = "Loading…", ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <span className={spinnerVariants({ size, variant })} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
);
LoadingSpinner.displayName = "LoadingSpinner";

/**
 * FullPageLoader — Full-page centered loading overlay.
 * Used during page-level lazy loads or auth hydration.
 */
export function FullPageLoader({ label = "Loading application…" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="xl" variant="primary" label={label} />
        <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
      </div>
    </div>
  );
}

/**
 * InlineLoader — Subtle inline loader for content regions.
 */
export function InlineLoader({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground py-2", className)} role="status">
      <LoadingSpinner size="sm" />
      <span>{label}</span>
    </div>
  );
}

export { LoadingSpinner, spinnerVariants };
