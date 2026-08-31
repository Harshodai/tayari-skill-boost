/**
 * DataState — one interaction language for loading / error / empty / ready.
 *
 * Use it anywhere a page renders async data so every surface behaves the same:
 *  - loading  → skeletons (never a bare spinner), announced via aria-busy
 *  - error    → inline error card with a retry affordance, role="alert"
 *  - empty    → EmptyState with an optional primary action
 *  - ready    → children
 */
import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { ListSkeleton } from "./skeletons";
import { cn } from "@/lib/utils";

export interface DataStateProps {
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  /** Custom skeleton; defaults to a list skeleton. */
  skeleton?: React.ReactNode;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: { label: string; onClick: () => void };
  errorTitle?: string;
  className?: string;
  children: React.ReactNode;
}

function messageOf(error: unknown): string {
  if (!error) return "Something went wrong.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong.";
}

export function InlineError({
  title = "Couldn't load this",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center",
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function DataState({
  loading,
  error,
  isEmpty,
  skeleton,
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyIcon,
  emptyAction,
  errorTitle,
  className,
  children,
}: DataStateProps) {
  if (loading) {
    return <div className={className}>{skeleton ?? <ListSkeleton />}</div>;
  }

  if (error) {
    return (
      <div className={className}>
        <InlineError title={errorTitle} message={messageOf(error)} onRetry={onRetry} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={className}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}
