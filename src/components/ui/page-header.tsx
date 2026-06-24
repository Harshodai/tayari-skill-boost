/**
 * PageHeader — Production-grade page header with breadcrumbs and actions
 *
 * Props/API:
 *  title         — Page title (h1)
 *  description   — Optional subtitle/description
 *  breadcrumbs   — Array of { label, href? } for breadcrumb navigation
 *  actions       — ReactNode (buttons, etc.) displayed top-right
 *  badge         — Optional ReactNode badge beside the title
 *  isLoading     — Show skeleton loading state
 *  backHref      — Optional back-navigation href
 *  backLabel     — Label for back button (default: "Back")
 *  className     — Extra Tailwind overrides
 *
 * Usage:
 *  <PageHeader
 *    title="Job Applications"
 *    description="Track and manage all your job applications"
 *    breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Applications" }]}
 *    badge={<StatusBadge status="active" dot />}
 *    actions={<Button>Add Application</Button>}
 *  />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  isLoading?: boolean;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
  isLoading,
  backHref,
  backLabel = "Back",
  className,
}: PageHeaderProps) {
  if (isLoading) {
    return (
      <div className={cn("mb-6 space-y-3", className)} aria-hidden="true">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <header className={cn("mb-6", className)}>
      {/* Breadcrumbs */}
      {(breadcrumbs?.length ?? 0) > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs!.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <svg
                    className="h-3 w-3 opacity-40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                    aria-current={i === breadcrumbs!.length - 1 ? "page" : undefined}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span
                    className={cn(i === breadcrumbs!.length - 1 && "text-foreground font-medium")}
                    aria-current={i === breadcrumbs!.length - 1 ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Back button */}
      {backHref && (
        <a
          href={backHref}
          className={cn(
            "mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground",
            "hover:text-foreground transition-colors group"
          )}
          aria-label={backLabel}
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {backLabel}
        </a>
      )}

      {/* Title row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight truncate">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

/**
 * SectionHeader — Lighter section-level heading with divider
 *
 * Usage:
 *  <SectionHeader title="Recent Applications" action={<Button size="sm">View all</Button>} />
 */
export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between mb-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { PageHeader, SectionHeader };
