/**
 * FilterBar — Responsive filter chips + sort dropdown toolbar
 *
 * Props/API:
 *  filters       — Array of { key, label, options: { value, label, count? }[], multiple? }
 *  activeFilters — Record<string, string | string[]>
 *  onFilterChange — (key: string, value: string | string[]) => void
 *  onClearAll    — () => void
 *  sortOptions   — Array of { value, label }
 *  activeSort    — Current sort value
 *  onSortChange  — (value: string) => void
 *  resultCount   — Number of results to show (e.g. "47 jobs")
 *  resultLabel   — Label for results (default: "results")
 *  className     — Extra Tailwind overrides
 *
 * Usage:
 *  <FilterBar
 *    filters={[
 *      { key: "type", label: "Job Type", options: [{ value: "full-time", label: "Full-time" }] },
 *      { key: "location", label: "Location", options: [...], multiple: true },
 *    ]}
 *    activeFilters={activeFilters}
 *    onFilterChange={setFilter}
 *    sortOptions={[{ value: "relevance", label: "Most Relevant" }]}
 *    activeSort={sort}
 *    onSortChange={setSort}
 *    resultCount={47}
 *  />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as SelectPrimitive from "@radix-ui/react-select";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  multiple?: boolean;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface FilterBarProps {
  filters?: FilterDef[];
  activeFilters?: Record<string, string | string[]>;
  onFilterChange?: (key: string, value: string | string[]) => void;
  onClearAll?: () => void;
  sortOptions?: SortOption[];
  activeSort?: string;
  onSortChange?: (value: string) => void;
  resultCount?: number;
  resultLabel?: string;
  className?: string;
}

function FilterBar({
  filters = [],
  activeFilters = {},
  onFilterChange,
  onClearAll,
  sortOptions = [],
  activeSort,
  onSortChange,
  resultCount,
  resultLabel = "results",
  className,
}: FilterBarProps) {
  const activeCount = Object.values(activeFilters).filter((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v)
  ).length;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      role="toolbar"
      aria-label="Filter and sort options"
    >
      {/* Left: Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => {
          const activeValue = activeFilters[filter.key];
          const isActive = Array.isArray(activeValue)
            ? activeValue.length > 0
            : Boolean(activeValue);

          return (
            <FilterChip
              key={filter.key}
              filter={filter}
              activeValue={activeValue}
              isActive={isActive}
              onChange={(val) => onFilterChange?.(filter.key, val)}
            />
          );
        })}

        {/* Clear all */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            )}
            aria-label={`Clear all ${activeCount} active filters`}
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Clear {activeCount > 1 ? `(${activeCount})` : "all"}
          </button>
        )}
      </div>

      {/* Right: Result count + Sort */}
      <div className="flex shrink-0 items-center gap-3">
        {resultCount !== undefined && (
          <p className="text-xs text-muted-foreground whitespace-nowrap" aria-live="polite">
            <span className="font-semibold text-foreground tabular-nums">{resultCount.toLocaleString()}</span> {resultLabel}
          </p>
        )}

        {sortOptions.length > 0 && (
          <SortSelect
            options={sortOptions}
            value={activeSort ?? ""}
            onChange={onSortChange ?? (() => {})}
          />
        )}
      </div>
    </div>
  );
}

/* ── FilterChip ─────────────────────────────────────────────── */
function FilterChip({
  filter,
  activeValue,
  isActive,
  onChange,
}: {
  filter: FilterDef;
  activeValue?: string | string[];
  isActive: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const displayLabel = React.useMemo(() => {
    if (!isActive) return filter.label;
    if (Array.isArray(activeValue)) {
      return activeValue.length === 1 ? activeValue[0] : `${filter.label} (${activeValue.length})`;
    }
    return filter.options.find((o) => o.value === activeValue)?.label ?? filter.label;
  }, [filter, activeValue, isActive]);

  const isSelected = (optionValue: string) => {
    if (Array.isArray(activeValue)) return activeValue.includes(optionValue);
    return activeValue === optionValue;
  };

  const handleToggle = (optionValue: string) => {
    if (filter.multiple) {
      const current = Array.isArray(activeValue) ? activeValue : activeValue ? [activeValue] : [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      onChange(next);
    } else {
      const isSame = activeValue === optionValue;
      onChange(isSame ? "" : optionValue);
      if (!isSame) setOpen(false);
    }
  };

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
          "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "border-primary bg-primary/10 text-primary"
            : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filter by ${filter.label}${isActive ? " — active" : ""}`}
      >
        {displayLabel}
        <svg
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[150px] rounded-xl border border-border/60 bg-popover py-1 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          role="listbox"
          aria-label={`${filter.label} options`}
          aria-multiselectable={filter.multiple}
        >
          {filter.options.map((option) => {
            const selected = isSelected(option.value);
            return (
              <DropdownMenuPrimitive.Item
                key={option.value}
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm",
                  "outline-none transition-colors data-[highlighted]:bg-muted/60",
                  selected ? "text-primary bg-primary/5" : "text-foreground hover:bg-muted/60"
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  handleToggle(option.value);
                }}
              >
                <span className="flex items-center gap-2">
                  {filter.multiple && (
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                        selected ? "border-primary bg-primary" : "border-border"
                      )}
                      aria-hidden="true"
                    >
                      {selected && (
                        <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                  )}
                  {option.label}
                </span>
                {option.count !== undefined && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                )}
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

/* ── SortSelect ─────────────────────────────────────────────── */
function SortSelect({
  options,
  value,
  onChange,
}: {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background",
          "px-3 py-1.5 text-xs font-medium text-muted-foreground",
          "hover:border-border hover:text-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="Sort by"
      >
        <svg className="h-3.5 w-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
        </svg>
        <SelectPrimitive.Value placeholder="Sort by" />
        <SelectPrimitive.Icon asChild>
          <svg className="h-3 w-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          align="end"
          className={cn(
            "z-50 min-w-[160px] rounded-xl border border-border/60 bg-popover py-1 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "flex cursor-pointer items-center px-3 py-2 text-sm outline-none transition-colors",
                  "text-foreground hover:bg-muted/60 data-[highlighted]:bg-muted/60 data-[state=checked]:text-primary data-[state=checked]:bg-primary/5"
                )}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { FilterBar };
