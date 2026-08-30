/**
 * Standard skeleton loaders.
 *
 * Every page uses these instead of ad-hoc spinners so loading feels identical
 * everywhere. All of them expose `role="status"` + `aria-busy` so screen
 * readers announce work in progress, and they inherit the reduced-motion
 * shimmer rules from index.css.
 */
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Stacked list rows — search results, run history, activity feeds. */
export function ListSkeleton({
  rows = 5,
  className,
  label = "Loading results",
}: {
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <SkeletonRegion label={label} className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/40 p-3"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Card grid — dashboards, product tiles, stat panels. */
export function CardGridSkeleton({
  cards = 3,
  className,
  label = "Loading cards",
}: {
  cards?: number;
  className?: string;
  label?: string;
}) {
  return (
    <SkeletonRegion
      label={label}
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Detail pane — job detail, resume preview, run inspector. */
export function DetailSkeleton({
  className,
  label = "Loading details",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <SkeletonRegion label={label} className={cn("space-y-4 p-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-9/12" />
      </div>
    </SkeletonRegion>
  );
}

/** Compact form skeleton — auth, onboarding, settings. */
export function FormSkeleton({
  fields = 3,
  className,
  label = "Loading form",
}: {
  fields?: number;
  className?: string;
  label?: string;
}) {
  return (
    <SkeletonRegion label={label} className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </SkeletonRegion>
  );
}
