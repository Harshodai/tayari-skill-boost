/**
 * Tayari UI Component System — Barrel Exports
 *
 * Production-grade, accessible, reusable components for the Job Tayari platform.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  COMPONENT REGISTRY                                             │
 * ├─────────────────┬───────────────────────────────────────────────┤
 * │  Feedback       │  LoadingSpinner, FullPageLoader, InlineLoader  │
 * │                 │  EmptyState presets, NotificationProvider      │
 * ├─────────────────┼───────────────────────────────────────────────┤
 * │  Layout         │  PageHeader, SectionHeader, StatsGrid          │
 * ├─────────────────┼───────────────────────────────────────────────┤
 * │  Data Display   │  DataTable, StatsCard, JobCard, JobCardGrid    │
 * │                 │  CompanyLogo, AtsScoreBadge, StatusBadge       │
 * ├─────────────────┼───────────────────────────────────────────────┤
 * │  Controls       │  AsyncButton, CopyButton, SearchInput          │
 * │                 │  FilterBar, ConfirmDialog                      │
 * ├─────────────────┼───────────────────────────────────────────────┤
 * │  Progress       │  ProgressStepper                               │
 * └─────────────────┴───────────────────────────────────────────────┘
 */

// ── Feedback ──────────────────────────────────────────────────────
export {
  LoadingSpinner,
  FullPageLoader,
  InlineLoader,
  type LoadingSpinnerProps,
} from "./loading-spinner";

export {
  EmptyState,
  JobsEmptyState,
  SearchEmptyState,
  ErrorEmptyState,
  type EmptyStateProps,
} from "./empty-state";

export {
  NotificationProvider,
  NotificationContainer,
  useNotify,
  type Toast,
} from "./notification-toast";

// ── Layout ────────────────────────────────────────────────────────
export {
  PageHeader,
  SectionHeader,
  type PageHeaderProps,
  type SectionHeaderProps,
  type BreadcrumbItem,
} from "./page-header";

// ── Data Display ──────────────────────────────────────────────────
export {
  DataTable,
  type DataTableProps,
  type ColumnDef,
} from "./data-table";

export {
  StatsCard,
  StatsGrid,
  type StatsCardProps,
} from "./stats-card";

export {
  JobCard,
  JobCardGrid,
  CompanyLogo,
  type Job,
  type JobCardProps,
} from "./job-card";

export {
  StatusBadge,
  AtsScoreBadge,
  type StatusBadgeProps,
  type AtsScoreBadgeProps,
  type ApplicationStatus,
} from "./status-badge";

// ── Controls ──────────────────────────────────────────────────────
export {
  AsyncButton,
  CopyButton,
  type AsyncButtonProps,
  type CopyButtonProps,
} from "./async-button";

export {
  SearchInput,
  type SearchInputProps,
} from "./search-input";

export {
  FilterBar,
  type FilterBarProps,
  type FilterDef,
  type FilterOption,
  type SortOption,
} from "./filter-bar";

export {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "./confirm-dialog";

// ── Progress ──────────────────────────────────────────────────────
export {
  ProgressStepper,
  type ProgressStepperProps,
  type Step,
} from "./progress-stepper";
