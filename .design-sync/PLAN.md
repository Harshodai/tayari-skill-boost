# JobTayari design-sync — checkpoint & resume plan

Checkpoint taken 2026-08-15, ~13:20. All 7 parallel preview-authoring subagents were killed on request. State below is what's actually on disk right now (verified, not assumed).

Two unrelated side-fixes are still running independently in separate sessions (spawned earlier from things found while reading source): `task_c136aa28` (corrupted transition class in `button.tsx`) and `task_2d954dbd` (orphaned duplicate `scroll-to-top.tsx`). Not stopped — user chose to only halt the design-sync subagents. They'll land on their own; not part of this plan.

## Live in the Claude Design project right now

Project: **JobTayari** — https://claude.ai/design/p/df95bfac-5441-4ef0-9349-1ed68b18e5a9

Pushed, verified, graded good: **Button, Card, JobCard** (13 cells total, all `good`). Base bundle (`_ds_bundle.js`, CSS, tokens, vendor React) is live too, so the project already renders real Job Tayari components today — just 3 of them with rich previews, the rest on the honest floor card (functional, unstyled-example).

## What's on disk but NOT verified or pushed

79 of 85 planned primary components have an authored `.design-sync/previews/<Name>.tsx` file (written by the killed subagents before they stopped). **None of these 79 have been rebuilt-clean, screenshotted, graded, or pushed** — the batches were killed mid-flow (some mid-authoring, at least one — Batch B forms — got as far as a scoped `preview-rebuild.mjs` run for its set, so a few `.html`/`_preview/*.js` artifacts in `ds-bundle/` may reflect real previews rather than floor cards, but this is inconsistent across the 79 and should not be trusted as-is). Treat all 79 as **written but unverified** — the safe resume path re-runs rebuild+capture+grade for every one of them from scratch rather than trying to figure out which partial state survived.

Preview files present (79): Accordion, Alert, AlertDialog, AnimatedGradientText, AnimatedNumber, AspectRatio, AsyncButton, AtsScoreBadge, Avatar, Badge, Breadcrumb, Calendar, CardHover, Carousel, ChartContainer, Checkbox, Collapsible, Command, CompanyLogo, ConfirmDialog, CopyButton, CountUp, CustomGradientText, DataTable, Dialog, Drawer, EmptyState, ErrorEmptyState, FadeIn, FilterBar, FloatingParticles, Form, FullPageLoader, HoverCard, InlineLoader, Input, InputOTP, JobCardGrid, JobMatchScore, JobsEmptyState, Label, LoadingSpinner, OrbBackground, PageHeader, Pagination, Popover, Progress, ProgressStepper, RadioGroup, ResizablePanelGroup, ScaleIn, ScoreDisplay, SearchEmptyState, SearchInput, SectionHeader, Select, Separator, Sheet, Skeleton, SlideUp, Slider, SpotlightCard, SpotlightGrid, StaggerContainer, StatsCard, StatsGrid, StatusBadge, Switch, Table, Tabs, Textarea, Toast, Toggle, ToggleGroup, Tooltip, UploadZone.

No `.design-sync/learnings/*.md` files exist — no batch got far enough to write one. No subagent touched `config.json` or `NOTES.md` (checked via `git status` — hard rules held).

## Missing entirely (0 progress, not written)

6 of the original 85-component plan have no preview file at all — Batch A (overlays) was killed early, mid-menu-components:

- **ContextMenu**
- **DropdownMenu**
- **Menubar**
- **NavigationMenu**

Batch A's earlier components (AlertDialog, Dialog, Drawer, Sheet, Popover, HoverCard, Tooltip) DID get written — see the 79-list above.

Batch G (misc/complex) also has 2 gaps from its 13-component assignment:
- **ScrollArea**
- **Sidebar** (the most complex one in that batch — needs `SidebarProvider` wrap)

## Config decisions already made (keep these on resume)

`.design-sync/config.json` currently has:
- `componentSrcMap`: `GradientOrb`, `ScrollToTop`, `Toaster` excluded — genuine ESM ambiguous-export collisions (two files each export the same name). Details + which is dead code vs intentional in `NOTES.md`.
- `guidelinesGlob: []` — **security fix**, do not remove without checking `docs/` content first. Default glob was sweeping this repo's internal ops docs (security findings, disaster recovery, audit reports) into the design-system upload.
- `docsDir: ".design-sync/.no-docs"` — same reason, pinned to a dead path so no repo doc content can ever leak into synthesized component docs.
- `overrides`: `Button`, `Card`, `JobCard` set to `cardMode: "column"` (fixes `[GRID_OVERFLOW]` — their stories render wider than a grid cell).

`.design-sync/tailwind-compiled.css` is a hand-copied snapshot from `vite build` — regenerate if components/pages changed meaningfully since 2026-08-15 (see NOTES.md CSS section for the exact steps).

## Resume steps, in order

1. **Author the 6 missing previews** (ContextMenu, DropdownMenu, Menubar, NavigationMenu, ScrollArea, Sidebar). Source files: `context-menu.tsx`, `dropdown-menu.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `scroll-area.tsx`, `sidebar.tsx` (Sidebar needs `SidebarProvider` wrap — same file). Follow the same recipe as the 79 already written: read `.design-sync/previews/Button.tsx`/`Card.tsx`/`JobCard.tsx` for the calibration bar, realistic Job Tayari domain content, compose open/interactive states for the menu components (they need `open`/`defaultOpen` forced true to be visible in a static screenshot).

2. **Full clean rebuild** from repo root (do NOT use a scoped/targeted rebuild here — this step re-establishes a known-good baseline across all 85):
   ```
   node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle --entry ./src/components/ui/_synth_entry_placeholder.ts
   node .ds-sync/package-validate.mjs ./ds-bundle
   ```
   Fix whatever `[TAG]`-prefixed errors/warnings come up per the self-heal table in the design-sync skill (`non-storybook/SKILL.md` §3) — expect at least the `[GRID_OVERFLOW]` pattern again for some of the newly-authored 82 (menus/dialogs especially), same fix as before (`cfg.overrides.<Name>: {"cardMode": "column"}` or `{"cardMode": "single", "primaryStory": "..."}` for ones that escape the grid).

3. **Capture + grade all 82 non-solo components** (everything except Button/Card/JobCard, which are already done):
   ```
   node .ds-sync/package-capture.mjs --out ./ds-bundle
   ```
   Read every `ds-bundle/_screenshots/review/general__<Name>.png`, grade on the absolute rubric (Styled / Complete / Plausible — see base skill §4.3), write `.design-sync/.cache/review/<Name>.grade.json`. This is the same fan-out-to-subagents approach as before if doing it in parallel again — just make sure whichever agents run it this time are told to **let each batch finish its full rebuild+capture+grade loop before being interrupted**, or checkpoint mid-batch is safe to lose (previews are already written, so a re-run of capture+grade is idempotent and cheap — it's not lost work, just unverified work).

4. **Push verified batches** to the project via `DesignSync` — plan is already open (`planId` was `plan_df95bfac54414ef0_1a87d6c810a4`; re-`finalize_plan` if that expired). Batch by however grading naturally groups; sentinel-fence each push per base `SKILL.md` §3.

5. **Author `.design-sync/conventions.md`** (the styling-idiom header for the design agent) once all previews are verified — Tailwind class vocabulary, `hsl(var(--token))` pattern, the `cn()` helper convention, dark-mode-first tokens, no shippable brand webfont (system font stack fallback — see NOTES.md Fonts section).

6. **Close out**: final full-content push, reconciliation deletes (`DesignSync(list_files)` diffed against final `ds-bundle/`), sentinel re-arm, `_ds_sync.json` written absolute last.

## Open questions for the user before resuming

- Resume now (re-launch subagents / continue directly), or hold here?
- OK to re-launch parallel subagents again, or do this one batch at a time serially this time (slower, easier to checkpoint cleanly)?
