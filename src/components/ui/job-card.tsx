/**
 * JobCard — Premium job listing card component for Tayari Skill Boost
 *
 * Props/API:
 *  job          — Job object { id, title, company, location, salary?, type, logo?, atsScore?, tags?, postedAt, isRemote?, isSaved? }
 *  variant      — "default" | "compact" | "featured"
 *  isLoading    — Show skeleton loading state
 *  onSave       — (id: string) => void — toggle saved
 *  onApply      — (id: string) => void
 *  onView       — (id: string) => void
 *  className    — Extra Tailwind overrides
 *
 * Usage:
 *  <JobCard job={job} onSave={handleSave} onApply={handleApply} />
 *  <JobCard isLoading /> {/* Skeleton state *\/}
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { AtsScoreBadge, StatusBadge } from "./status-badge";
import { AsyncButton } from "./async-button";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  type: string;
  logoUrl?: string;
  atsScore?: number;
  tags?: string[];
  postedAt: string;
  isRemote?: boolean;
  isSaved?: boolean;
  applicationStatus?: import("./status-badge").ApplicationStatus;
}

export interface JobCardProps {
  job?: Job;
  variant?: "default" | "compact" | "featured";
  isLoading?: boolean;
  onSave?: (id: string) => void | Promise<void>;
  onApply?: (id: string) => void | Promise<void>;
  onView?: (id: string) => void;
  className?: string;
}

/* ── Loading skeleton ─────────────────────────────────────── */
function JobCardSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-5 space-y-4"
      aria-label="Loading job card"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      </div>
      {!compact && (
        <>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Company Logo ─────────────────────────────────────────── */
function CompanyLogo({
  logoUrl,
  company,
  size = "md",
}: {
  logoUrl?: string;
  company: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeCls = { sm: "h-8 w-8 text-xs", md: "h-12 w-12 text-sm", lg: "h-16 w-16 text-lg" };
  const [imgError, setImgError] = React.useState(false);

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={`${company} logo`}
        className={cn("rounded-xl object-contain bg-white border border-border/40 p-1 shrink-0", sizeCls[size])}
        onError={() => setImgError(true)}
        loading="lazy"
        width={size === "sm" ? 32 : size === "md" ? 48 : 64}
        height={size === "sm" ? 32 : size === "md" ? 48 : 64}
      />
    );
  }

  // Fallback avatar with company initial
  const initial = company.charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10",
        "flex items-center justify-center font-semibold text-primary shrink-0",
        sizeCls[size]
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

/* ── Main Card ────────────────────────────────────────────── */
function JobCard({
  job,
  variant = "default",
  isLoading,
  onSave,
  onApply,
  onView,
  className,
}: JobCardProps) {
  if (isLoading || !job) {
    return <JobCardSkeleton compact={variant === "compact"} />;
  }

  const isCompact = variant === "compact";
  const isFeatured = variant === "featured";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && onView) {
      e.preventDefault();
      onView(job.id);
    }
  };

  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card text-card-foreground",
        "transition-all duration-300",
        isFeatured
          ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-md hover:shadow-glow"
          : "border-border/50 hover:border-border hover:-translate-y-0.5 hover:shadow-md",
        onView && "cursor-pointer",
        className
      )}
      onClick={onView ? () => onView(job.id) : undefined}
      onKeyDown={onView ? handleKeyDown : undefined}
      tabIndex={onView ? 0 : undefined}
      role={onView ? "button" : "article"}
      aria-label={`${job.title} at ${job.company}${job.applicationStatus ? ` — ${job.applicationStatus}` : ""}`}
    >
      {/* Featured ribbon */}
      {isFeatured && (
        <div className="absolute -top-px left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" aria-hidden="true" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={isCompact ? "sm" : "md"} />

          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold text-foreground leading-snug truncate", isCompact ? "text-sm" : "text-base")}>
              {job.title}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground truncate">{job.company}</p>
          </div>

          {/* Save button */}
          {onSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave(job.id);
              }}
              aria-label={job.isSaved ? "Remove from saved" : "Save job"}
              aria-pressed={job.isSaved}
              className={cn(
                "shrink-0 rounded-lg p-1.5 transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                job.isSaved
                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill={job.isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
            </button>
          )}
        </div>

        {/* Meta chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {/* Location */}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            {job.location}
          </span>

          {job.isRemote && (
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
              Remote
            </span>
          )}

          {/* Job type */}
          <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {job.type}
          </span>

          {/* Salary */}
          {job.salary && (
            <span className="inline-flex items-center text-xs font-medium text-foreground">
              {job.salary}
            </span>
          )}

          {/* ATS Score */}
          {job.atsScore !== undefined && (
            <AtsScoreBadge score={job.atsScore} size="sm" />
          )}

          {/* Application status */}
          {job.applicationStatus && (
            <StatusBadge status={job.applicationStatus} size="sm" />
          )}
        </div>

        {/* Skill tags — not shown in compact */}
        {!isCompact && job.tags && job.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {job.tags.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{job.tags.length - 4} more</span>
            )}
          </div>
        )}

        {/* Footer */}
        {!isCompact && (
          <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-border/30">
            <time
              dateTime={job.postedAt}
              className="text-xs text-muted-foreground"
              aria-label={`Posted ${job.postedAt}`}
            >
              {job.postedAt}
            </time>

            {(onApply || onView) && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {onView && (
                  <button
                    type="button"
                    onClick={() => onView(job.id)}
                    className={cn(
                      "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium",
                      "border border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    aria-label={`View details for ${job.title}`}
                  >
                    View
                  </button>
                )}
                {onApply && (
                  <AsyncButton
                    size="sm"
                    onClick={() => onApply(job.id)}
                    loadingText="Applying…"
                    successText="Applied!"
                    aria-label={`Apply to ${job.title} at ${job.company}`}
                    className="text-xs"
                  >
                    Apply
                  </AsyncButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * JobCardGrid — Responsive grid wrapper for job cards
 */
function JobCardGrid({
  children,
  columns = 2,
  className,
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const colsCls = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  };
  return (
    <div className={cn("grid gap-4", colsCls[columns], className)}>
      {children}
    </div>
  );
}

export { JobCard, JobCardGrid, CompanyLogo };
