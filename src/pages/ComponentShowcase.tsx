/**
 * ComponentShowcase — Interactive demo of all Tayari UI components
 *
 * Route: /components (gate with feature flag or admin-only in prod)
 *
 * This page serves as:
 *  1. Developer reference / living style guide
 *  2. Visual regression testing baseline
 *  3. Design system documentation
 */

import * as React from "react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatsCard, StatsGrid } from "@/components/ui/stats-card";
import { LoadingSpinner, FullPageLoader, InlineLoader } from "@/components/ui/loading-spinner";
import { EmptyState, JobsEmptyState, SearchEmptyState, ErrorEmptyState } from "@/components/ui/empty-state";
import { StatusBadge, AtsScoreBadge } from "@/components/ui/status-badge";
import { AsyncButton, CopyButton } from "@/components/ui/async-button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { JobCard, JobCardGrid, type Job } from "@/components/ui/job-card";
import { ProgressStepper } from "@/components/ui/progress-stepper";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotificationProvider, useNotify } from "@/components/ui/notification-toast";
import { Button } from "@/components/ui/button";

/* ── Demo Data ─────────────────────────────────────────────────── */
const DEMO_JOBS: Job[] = [
  {
    id: "1",
    title: "Senior Frontend Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    salary: "$180k – $220k",
    type: "Full-time",
    isRemote: true,
    isSaved: false,
    atsScore: 87,
    tags: ["React", "TypeScript", "GraphQL", "Tailwind"],
    postedAt: "2 days ago",
    applicationStatus: "interview",
  },
  {
    id: "2",
    title: "Staff Software Engineer",
    company: "Linear",
    location: "Remote",
    salary: "$200k – $250k",
    type: "Full-time",
    isRemote: true,
    isSaved: true,
    atsScore: 63,
    tags: ["React", "Node.js", "PostgreSQL", "Redis"],
    postedAt: "1 day ago",
    applicationStatus: "applied",
  },
  {
    id: "3",
    title: "Product Engineer",
    company: "Vercel",
    location: "New York, NY",
    salary: "$160k – $190k",
    type: "Full-time",
    isRemote: false,
    atsScore: 45,
    tags: ["Next.js", "Edge Runtime", "Go", "Rust"],
    postedAt: "3 hours ago",
  },
];

type AppRow = {
  id: string;
  company: string;
  role: string;
  status: "applied" | "interview" | "offer" | "rejected";
  atsScore: number;
  date: string;
};

const DEMO_TABLE_DATA: AppRow[] = [
  { id: "1", company: "Stripe", role: "Senior Frontend Engineer", status: "interview", atsScore: 87, date: "Jun 20" },
  { id: "2", company: "Linear", role: "Staff Engineer", status: "applied", atsScore: 63, date: "Jun 19" },
  { id: "3", company: "Vercel", role: "Product Engineer", status: "offer", atsScore: 92, date: "Jun 15" },
  { id: "4", company: "Figma", role: "Frontend Developer", status: "rejected", atsScore: 41, date: "Jun 10" },
];

const TABLE_COLUMNS: ColumnDef<AppRow>[] = [
  { key: "company", header: "Company", sortable: true },
  { key: "role", header: "Role", className: "max-w-[200px] truncate" },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} size="sm" />,
  },
  {
    key: "atsScore",
    header: "ATS Score",
    align: "center",
    sortable: true,
    render: (row) => <AtsScoreBadge score={row.atsScore} size="sm" />,
  },
  { key: "date", header: "Date", align: "right" },
];

const RESUME_STEPS = [
  { id: "upload", label: "Upload", description: "Upload your resume PDF" },
  { id: "analyze", label: "Analysis", description: "AI ATS scan" },
  { id: "optimize", label: "Optimize", description: "AI rewrites" },
  { id: "export", label: "Export", description: "Download final" },
];

/* ── Inner showcase content (needs useNotify) ─────────────────── */
function ShowcaseContent() {
  const notify = useNotify();
  const [savedJobs, setSavedJobs] = React.useState<Set<string>>(new Set(["2"]));
  const [searchValue, setSearchValue] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState<Record<string, string | string[]>>({});
  const [activeSort, setActiveSort] = React.useState("relevance");
  const [stepperStep, setStepperStep] = React.useState(2);
  const [tableLoading, setTableLoading] = React.useState(false);

  const jobs = DEMO_JOBS.map((j) => ({
    ...j,
    isSaved: savedJobs.has(j.id),
  }));

  const handleSave = (id: string) => {
    setSavedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        notify.info("Job removed from saved");
      } else {
        next.add(id);
        notify.success("Job saved!");
      }
      return next;
    });
  };

  const handleDelete = async () => {
    await new Promise((r) => setTimeout(r, 1500));
    notify.success("Application deleted");
    setConfirmOpen(false);
  };

  const handleAsyncSubmit = async () => {
    await new Promise((r) => setTimeout(r, 2000));
    notify.success("Resume submitted for analysis!");
  };

  const handlePromiseToast = () => {
    notify.promise(
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Analyzing your resume…",
        success: "ATS analysis complete! Score: 87%",
        error: "Analysis failed. Please retry.",
      }
    );
  };

  const handleTableReload = () => {
    setTableLoading(true);
    setTimeout(() => setTableLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-16">

        {/* Hero header */}
        <PageHeader
          title="Tayari UI System"
          description="Production-grade, accessible, reusable components — built for scale."
          breadcrumbs={[{ label: "Home", href: "/" }, { label: "Components" }]}
          badge={
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              v2.0
            </span>
          }
          actions={
            <div className="flex gap-2">
              <CopyButton text='import { JobCard } from "@/components/ui/tayari-ui"' label="Copy import" />
              <Button size="sm" variant="glow">View Docs</Button>
            </div>
          }
        />

        {/* ── Stats ──────────────────────────────────────────────── */}
        <section aria-labelledby="stats-heading">
          <SectionHeader id="stats-heading" title="StatsCard" description="KPI metrics with loading, trends & color schemes" />
          <StatsGrid columns={4}>
            <StatsCard
              label="ATS Score"
              value="87%"
              trend={{ value: 12, direction: "up", label: "vs last scan" }}
              colorScheme="success"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>}
            />
            <StatsCard
              label="Applications"
              value="42"
              trend={{ value: 8, direction: "up", label: "this month" }}
              colorScheme="primary"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" /></svg>}
            />
            <StatsCard
              label="Interviews"
              value="7"
              trend={{ value: 3, direction: "down", label: "vs last month" }}
              colorScheme="warning"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>}
            />
            <StatsCard label="Offers" value="2" colorScheme="default" isLoading={false}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>}
            />
          </StatsGrid>

          {/* Loading skeleton demo */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Loading state:</p>
            <StatsGrid columns={4}>
              {[...Array(4)].map((_, i) => <StatsCard key={i} label="" value="" isLoading />)}
            </StatsGrid>
          </div>
        </section>

        {/* ── Job Cards ──────────────────────────────────────────── */}
        <section aria-labelledby="job-cards-heading">
          <SectionHeader id="job-cards-heading" title="JobCard" description="Full, compact, featured, loading and saved states" />
          <div className="space-y-4">
            {/* Filter bar */}
            <FilterBar
              filters={[
                { key: "type", label: "Job Type", options: [{ value: "full-time", label: "Full-time" }, { value: "contract", label: "Contract" }, { value: "part-time", label: "Part-time" }] },
                { key: "remote", label: "Remote", options: [{ value: "yes", label: "Remote only" }, { value: "hybrid", label: "Hybrid" }] },
                { key: "skills", label: "Skills", multiple: true, options: [{ value: "react", label: "React", count: 34 }, { value: "typescript", label: "TypeScript", count: 28 }, { value: "node", label: "Node.js", count: 19 }] },
              ]}
              activeFilters={activeFilters}
              onFilterChange={(key, val) => setActiveFilters((p) => ({ ...p, [key]: val }))}
              onClearAll={() => setActiveFilters({})}
              sortOptions={[{ value: "relevance", label: "Most Relevant" }, { value: "newest", label: "Newest" }, { value: "salary", label: "Highest Pay" }]}
              activeSort={activeSort}
              onSortChange={setActiveSort}
              resultCount={3}
              resultLabel="jobs"
            />

            <JobCardGrid columns={2}>
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  variant={job.id === "1" ? "featured" : "default"}
                  onSave={handleSave}
                  onApply={(id) => notify.promise(
                    new Promise((r) => setTimeout(r, 1500)),
                    { loading: "Submitting application…", success: "Application submitted!", error: "Submission failed." }
                  )}
                  onView={(id) => notify.info(`Viewing job ${id}`)}
                />
              ))}
              {/* Loading skeleton */}
              <JobCard isLoading />
            </JobCardGrid>
          </div>
        </section>

        {/* ── DataTable ──────────────────────────────────────────── */}
        <section aria-labelledby="table-heading">
          <SectionHeader
            id="table-heading"
            title="DataTable"
            description="Sortable, accessible table with loading and empty states"
            action={
              <Button size="sm" variant="outline" onClick={handleTableReload}>
                {tableLoading ? "Loading…" : "Toggle loading"}
              </Button>
            }
          />
          <DataTable
            columns={TABLE_COLUMNS}
            data={tableLoading ? [] : DEMO_TABLE_DATA}
            isLoading={tableLoading}
            caption="Job applications table"
            emptyTitle="No applications yet"
            emptyMessage="Start applying to see your applications tracked here."
            onSort={(key, dir) => notify.info(`Sorting by ${key} ${dir}`)}
            onRowClick={(row) => notify.info(`Selected: ${row.company} — ${row.role}`)}
          />
        </section>

        {/* ── Progress Stepper ───────────────────────────────────── */}
        <section aria-labelledby="stepper-heading">
          <SectionHeader id="stepper-heading" title="ProgressStepper" description="Horizontal and vertical multi-step progress" />
          <div className="space-y-8">
            <div className="rounded-xl border border-border/50 bg-card p-6">
              <p className="text-xs text-muted-foreground mb-4">Horizontal — Step {stepperStep + 1} of {RESUME_STEPS.length}</p>
              <ProgressStepper
                steps={RESUME_STEPS}
                currentStep={stepperStep}
                onStepClick={setStepperStep}
              />
              <div className="mt-6 flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setStepperStep((s) => Math.max(0, s - 1))} disabled={stepperStep === 0}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setStepperStep((s) => Math.min(RESUME_STEPS.length - 1, s + 1))} disabled={stepperStep === RESUME_STEPS.length - 1}>
                  Next
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-6 max-w-xs">
              <p className="text-xs text-muted-foreground mb-4">Vertical</p>
              <ProgressStepper
                steps={RESUME_STEPS}
                currentStep={stepperStep}
                orientation="vertical"
                onStepClick={setStepperStep}
              />
            </div>
          </div>
        </section>

        {/* ── Badges ─────────────────────────────────────────────── */}
        <section aria-labelledby="badges-heading">
          <SectionHeader id="badges-heading" title="StatusBadge & AtsScoreBadge" description="All application status states + ATS scoring" />
          <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["applied", "screening", "interview", "offer", "rejected", "saved", "pending", "active", "paused", "completed", "draft"] as const).map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[92, 78, 55, 34].map((score) => (
                <AtsScoreBadge key={score} score={score} />
              ))}
              {[92, 78, 55].map((score) => (
                <AtsScoreBadge key={`sm-${score}`} score={score} size="sm" />
              ))}
            </div>
          </div>
        </section>

        {/* ── Loading States ─────────────────────────────────────── */}
        <section aria-labelledby="loading-heading">
          <SectionHeader id="loading-heading" title="Loading States" description="Spinner variants, sizes, and contextual loaders" />
          <div className="rounded-xl border border-border/50 bg-card p-6 space-y-6">
            {/* Sizes */}
            <div>
              <p className="text-xs text-muted-foreground mb-3">Sizes</p>
              <div className="flex flex-wrap items-center gap-6">
                {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
                  <div key={size} className="flex flex-col items-center gap-2">
                    <LoadingSpinner size={size} />
                    <span className="text-[10px] text-muted-foreground">{size}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Variants */}
            <div>
              <p className="text-xs text-muted-foreground mb-3">Variants</p>
              <div className="flex flex-wrap items-center gap-6">
                {(["primary", "secondary", "success", "destructive"] as const).map((v) => (
                  <div key={v} className="flex flex-col items-center gap-2">
                    <LoadingSpinner variant={v} />
                    <span className="text-[10px] text-muted-foreground">{v}</span>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-lg bg-foreground p-2">
                    <LoadingSpinner variant="white" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">white</span>
                </div>
              </div>
            </div>
            {/* Contextual */}
            <InlineLoader label="Fetching job listings…" />
          </div>
        </section>

        {/* ── Empty States ───────────────────────────────────────── */}
        <section aria-labelledby="empty-heading">
          <SectionHeader id="empty-heading" title="Empty States" description="Zero-state and error state presets" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-card">
              <JobsEmptyState onClear={() => notify.info("Filters cleared")} />
            </div>
            <div className="rounded-xl border border-border/50 bg-card">
              <SearchEmptyState query="senior react engineer" onReset={() => notify.info("Search reset")} />
            </div>
            <div className="rounded-xl border border-border/50 bg-card">
              <ErrorEmptyState message="Failed to load applications." onRetry={() => notify.info("Retrying…")} />
            </div>
          </div>
        </section>

        {/* ── Buttons & Controls ─────────────────────────────────── */}
        <section aria-labelledby="controls-heading">
          <SectionHeader id="controls-heading" title="Controls" description="AsyncButton, CopyButton, SearchInput" />
          <div className="space-y-6">
            {/* Buttons */}
            <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
              <p className="text-xs text-muted-foreground">AsyncButton — auto-manages loading/success/error</p>
              <div className="flex flex-wrap gap-3">
                <AsyncButton
                  onClick={handleAsyncSubmit}
                  loadingText="Analyzing…"
                  successText="Analysis Done!"
                  variant="glow"
                >
                  Analyze Resume
                </AsyncButton>
                <AsyncButton
                  onClick={() => new Promise((_, reject) => setTimeout(reject, 1500))}
                  loadingText="Saving…"
                  errorText="Save failed"
                  variant="outline"
                >
                  Trigger Error
                </AsyncButton>
                <CopyButton text="npx tayari-cli optimize --file resume.pdf" label="Copy CLI command" />
                <Button onClick={handlePromiseToast} variant="secondary">Promise Toast Demo</Button>
              </div>
            </div>

            {/* Search */}
            <div className="rounded-xl border border-border/50 bg-card p-6 space-y-3">
              <p className="text-xs text-muted-foreground">SearchInput — debounce, clear, suggestions</p>
              <SearchInput
                value={searchValue}
                onChange={setSearchValue}
                onSearch={(q) => q && notify.info(`Searching: "${q}"`)}
                placeholder="Search jobs, companies, skills…"
                suggestions={["React Developer", "TypeScript Engineer", "Frontend Lead", "Full Stack", "Node.js"]}
                size="md"
              />
            </div>
          </div>
        </section>

        {/* ── ConfirmDialog ──────────────────────────────────────── */}
        <section aria-labelledby="dialog-heading">
          <SectionHeader id="dialog-heading" title="ConfirmDialog" description="Accessible, animated confirmation dialog" />
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <div className="flex gap-3">
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                Delete Application
              </Button>
            </div>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete this application?"
            description="This will permanently remove the application from your tracker. This action cannot be undone."
            variant="destructive"
            confirmLabel="Delete"
            onConfirm={handleDelete}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            }
          />
        </section>

        {/* Footer */}
        <footer className="border-t border-border/50 pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Tayari UI System · Production-grade · Accessible · Dark-mode first
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ── Page export ──────────────────────────────────────────────── */
export default function ComponentShowcase() {
  return (
    <NotificationProvider>
      <ShowcaseContent />
    </NotificationProvider>
  );
}
