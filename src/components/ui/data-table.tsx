/**
 * DataTable — Production-grade table with loading, empty, and error states
 *
 * Props/API:
 *  columns       — Column definitions: { key, header, render?, className?, sortable?, align? }
 *  data          — Array of row data objects (T extends { id: string | number })
 *  isLoading     — Show skeleton loading state
 *  error         — Error message to display in error state
 *  emptyTitle    — Title when data is empty
 *  emptyMessage  — Description when data is empty
 *  onSort        — (key: string, direction: "asc"|"desc") => void
 *  caption       — Accessible table caption (screen readers)
 *  skeletonRows  — Number of skeleton rows to show while loading (default: 5)
 *  className     — Extra Tailwind overrides
 *
 * Usage:
 *  <DataTable
 *    columns={[
 *      { key: "company", header: "Company", sortable: true },
 *      { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
 *    ]}
 *    data={applications}
 *    isLoading={loading}
 *    emptyTitle="No applications yet"
 *    emptyMessage="Start applying to track your progress here."
 *    caption="Job applications list"
 *  />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { ErrorEmptyState } from "./empty-state";

type Align = "left" | "center" | "right";

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  align?: Align;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  caption?: string;
  skeletonRows?: number;
  className?: string;
  rowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
}

type SortState = { key: string; direction: "asc" | "desc" } | null;

const alignCls: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  emptyTitle = "No data found",
  emptyMessage = "There's nothing to show here yet.",
  emptyIcon,
  onSort,
  caption,
  skeletonRows = 5,
  className,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const [sortState, setSortState] = React.useState<SortState>(null);

  const handleSort = React.useCallback(
    (key: string) => {
      setSortState((prev) => {
        const newDir = prev?.key === key && prev.direction === "asc" ? "desc" : "asc";
        onSort?.(key, newDir);
        return { key, direction: newDir };
      });
    },
    [onSort]
  );

  /* ── Error State ──────────────────────────────────── */
  if (error) {
    return <ErrorEmptyState message={error} onRetry={onRetry} />;
  }

  /* ── Loading State ────────────────────────────────── */
  const renderLoadingRows = () =>
    Array.from({ length: skeletonRows }).map((_, ri) => (
      <tr key={ri} aria-hidden="true" className="border-b border-border/40">
        {columns.map((col, ci) => (
          <td key={ci} className="px-4 py-3">
            <Skeleton className="h-4 w-full max-w-[180px]" />
          </td>
        ))}
      </tr>
    ));

  /* ── Empty State ──────────────────────────────────── */
  const renderEmptyState = () => (
    <tr>
      <td colSpan={columns.length} className="py-0">
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          {emptyIcon && (
            <div className="mb-4 h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              {emptyIcon}
            </div>
          )}
          <p className="font-semibold text-foreground">{emptyTitle}</p>
          {emptyMessage && (
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">{emptyMessage}</p>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className={cn("w-full overflow-auto rounded-lg border border-border/50", className)}>
      <table className="w-full caption-bottom text-sm" role="grid" aria-label={caption}>
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}

        <thead>
          <tr className="border-b border-border/50 bg-muted/40">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-3 font-medium text-muted-foreground whitespace-nowrap",
                  alignCls[col.align ?? "left"],
                  col.sortable &&
                    "cursor-pointer select-none hover:text-foreground transition-colors",
                  col.headerClassName
                )}
                aria-sort={
                  sortState?.key === col.key
                    ? sortState.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : col.sortable
                    ? "none"
                    : undefined
                }
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1.5">
                  {col.header}
                  {col.sortable && (
                    <SortIcon
                      active={sortState?.key === col.key}
                      direction={sortState?.key === col.key ? sortState.direction : null}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading
            ? renderLoadingRows()
            : data.length === 0
            ? renderEmptyState()
            : data.map((row, ri) => (
                <tr
                  key={String((row as Record<string, unknown>).id ?? ri)}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/40",
                    rowClassName?.(row, ri)
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3",
                        alignCls[col.align ?? "left"],
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row, ri)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Sort icon ─────────────────────────────────────────────── */
function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc" | null;
}) {
  return (
    <span className="flex flex-col gap-0.5 opacity-60" aria-hidden="true">
      <svg
        className={cn(
          "h-2 w-2 transition-opacity",
          active && direction === "asc" ? "opacity-100 text-primary" : "opacity-30"
        )}
        viewBox="0 0 8 5"
        fill="currentColor"
      >
        <path d="M4 0L8 5H0z" />
      </svg>
      <svg
        className={cn(
          "h-2 w-2 transition-opacity",
          active && direction === "desc" ? "opacity-100 text-primary" : "opacity-30"
        )}
        viewBox="0 0 8 5"
        fill="currentColor"
      >
        <path d="M4 5L0 0h8z" />
      </svg>
    </span>
  );
}

export { DataTable };
