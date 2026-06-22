# Tayari Rebuild Plan — Unified, Smart, Cross-Product

## 0. First: get the preview loading again

Symptom: blank/not-loading in Lovable preview. Before any redesign:

1. Open the live preview in a headless browser, capture console errors, network 4xx/5xx, and the rendered DOM (Playwright via shell).
2. Walk the recent edits — `src/vite-env.d.ts`, `src/globals.d.ts`, `src/index.css`, `tailwind.config.ts`, `src/contexts/ThemeContext.tsx`, `src/main.tsx` — these were touched across the last few turns and are the most likely culprits (ambient `chrome`/`process` typings, theme provider mount order, CSS token typos).
3. Fix the first runtime error, re-capture, repeat until `/`, `/resume`, `/dashboard`, `/jobs`, `/auth` all render.
4. Only then start the redesign work below.

## 1. The product story (what we're actually selling)

Today the app reads like 8 disconnected tools in one nav. We re-frame Tayari around **one promise**: *"Land the job. We handle the rest."* — a single AI career copilot with four connected workflows:

```
                    ┌───────────────────────────┐
                    │   Profile + Resume Core   │  ← single source of truth
                    └─────────────┬─────────────┘
                                  │ feeds
        ┌────────────┬────────────┼────────────┬────────────┐
        ▼            ▼            ▼            ▼            ▼
   Smart Search   Optimizer   Interview     Outreach     Roadmap
   + AutoPilot   (resume +   (board + AI    (cover +     (skills +
                 cover)       prep)         comms hub)   growth)
```

Every feature reads from and writes to the Profile/Resume core, so work in one place flows into the others. That's the "combined offerings" the user is asking for.

## 2. UI system — one brand, one feel

- **Visual language**: dark-first (deep navy `#0a0f1f`), Apple-style SF stack already in place, indigo → teal → emerald gradient as the single brand accent. Light mode is the secondary theme, not the default.
- **Components**: one shared shell — `AppShell` with a collapsible left sidebar (shadcn `Sidebar`) grouped by workflow (Core / Apply / Prepare / Grow), a slim top bar with global search + AI assistant + profile, and a right-side **Activity Drawer** for automation runs.
- **Page archetypes**: every page conforms to one of four templates (Workspace, List+Detail, Wizard, Dashboard). Stops the "every page looks different" problem.
- **Motion**: subtle. Page fade, card lift on hover, gradient text on hero only. Respect `prefers-reduced-motion`. Strip particles, mouse spotlight, smart-hide header.
- **Empty / loading / error states**: define once, reuse. Today they're missing on most pages — that's part of why preview "looks broken."

## 3. Onboarding — simple, 3 steps, skippable

Replace anything multi-page or form-heavy. New flow on `/onboarding` after signup:

```
Step 1: Upload resume (or paste LinkedIn URL, or "skip — I'll add later")
        → resume is parsed once, fills Profile + Skills + Experience automatically
Step 2: Pick goal: [Find a new job] [Get promoted] [Switch careers] [Just exploring]
        → goal drives which modules surface first in the sidebar
Step 3: Pick 1–3 target roles via autocomplete (e.g. "Senior PM", "Data Eng")
        → seeds Smart Search + Roadmap immediately
```

That's it. Everything else (location, salary, notice period, work auth) is captured **just-in-time** when a feature actually needs it, inline, never as a wall of fields.

## 4. Profile — single source of truth, not another form

`/profile` becomes a **living card**, not a settings page:

- Header: avatar, name, target role, headline, completeness ring (e.g. "Profile 72%").
- Tabs: Resume (parsed sections, editable inline) · Preferences (location/comp/visa, asked lazily) · Skills (auto-extracted, user can pin top 8) · Activity (what AutoPilot did on my behalf).
- One "Improve with AI" button per section — same pattern everywhere.
- Profile data is the input to Optimizer, Smart Search, Cover Letter, Interview Prep — so updating it once propagates.

## 5. Smart Job Search — the centerpiece

Replace the current basic search page with a **three-pane workspace**:

```
┌──────────────┬─────────────────────────┬──────────────────────┐
│  Filters     │  Results (ranked)        │  Selected job        │
│  + Saved     │  match %, salary, posted │  JD, match breakdown │
│  searches    │  one-click Apply / Save  │  Apply with AutoPilot│
└──────────────┴─────────────────────────┴──────────────────────┘
```

Smart bits:

- **AI match score** per row (uses the JobMatchScore component already built) computed from Profile + JD.
- **"Why this job"** explainer chip per result — 1 line, e.g. "Matches 6/8 of your skills, salary above target."
- **Natural-language search bar**: "Remote senior PM jobs in fintech, $180k+, posted this week" — parsed server-side via the existing LLM service.
- **Saved searches** become **alerts** with a toggle ("Notify me daily"). Backed by `saved_jobs` + a new `job_alerts` table.
- **AutoPilot handoff**: every job row has a kebab → "Queue for AutoPilot" which drops it into the automation pipeline (next section). No context switch.

## 6. Cross-product automation — the Activity Drawer

The right-side drawer is **always one click away** from any page and shows the live automation pipeline:

```
Activity ──────────────────────────────
● Optimizing resume for "Senior PM @ Stripe"      ✓ done
● Generating cover letter                          ⟳ running
● Drafting recruiter outreach                      … queued
● AutoPilot: applying to 4 saved jobs              ⟳ 2/4
```

Each item is a chain. Selecting a job in Search and clicking "Apply" triggers a single workflow that runs Optimizer → Cover Letter → Application submission → Communication Hub follow-up draft, all stitched together. Built on the existing `agent_runs` table + Hermes orchestrator; UI just needs the streaming list, status pills, and a per-run detail modal.

This is the "automations from one product to another" the user called out — it's surfaced visibly in the UI, not buried in a separate route.

## 7. Dashboard — the daily landing

`/dashboard` becomes the workflow hub, not a stats wall:

- **Hero card**: "Today's focus" — 1 next action, AI-picked from your pipeline.
- **Pipeline kanban**: Saved → Applied → Interviewing → Offer. Drag to move.
- **Roadmap progress strip**: next 3 skill milestones.
- **Upcoming interviews** with one-click "Practice with AI" → opens Interview Prep pre-loaded with the JD.
- **Recent activity** (mirrors the Activity Drawer feed).

## 8. Information architecture (new nav)

Sidebar, grouped:

- **Core**: Dashboard, Profile, Resume
- **Apply**: Smart Search, AutoPilot, Saved Jobs, Cover Letters
- **Prepare**: Interview Board, AI Interview Prep, Communication Hub
- **Grow**: Career Roadmap, Blog
- Footer of sidebar: Settings, Help, theme toggle, sign out

Feature flags continue to gate prod-vs-preview as today — no change to `src/config/features.ts` logic.

## 9. Scope for this iteration (so it's shippable)

Order of operations:

1. Fix preview load (Section 0).
2. Ship the unified `AppShell` + new sidebar + Activity Drawer skeleton.
3. Redesign Dashboard, Profile, Smart Search to the new templates.
4. Wire the cross-product "Apply" workflow through the Activity Drawer using existing endpoints.
5. Replace onboarding with the 3-step flow.
6. Sweep remaining pages (Optimizer, Cover Letter, Interview, Roadmap) to the shared templates — visual only, no logic changes.

Out of scope this round: backend schema changes beyond `job_alerts`, Hermes provider work, payments, mobile-native polish (we'll keep it responsive but desktop-first).

## 10. Technical notes

- All new tokens go to `src/index.css` + `tailwind.config.ts`; no raw hex in components.
- `AppShell` lives at `src/components/layout/AppShell.tsx`; all protected routes wrap in it.
- Activity Drawer is a context (`AutomationContext`) + Sheet UI, fed by polling `/api/v1/hermes/runs` (already exists).
- Smart Search natural-language parsing reuses `llm_service` via a new `/api/v1/jobs/parse-query` endpoint (Python side, thin wrapper).
- New table `job_alerts (user_id, query jsonb, cadence, last_run_at)` with RLS owner-only + GRANTs per house rules.
- Onboarding state stored on `profiles` (`onboarding_step`, `goal`, `target_roles text[]`) — additive migration only.
- Keep Preview-vs-Prod feature flags untouched.

Ready to start with Section 0 (fix the load) and then Section 2–3 (shell + dashboard + search) on approval. Add backend docs as well if needed