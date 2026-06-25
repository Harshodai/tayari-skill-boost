
# Frontend Audit & Next-Wave UX Plan (Frontend Only)

## 1. Ruthless audit — what's actually wrong today

Walked the full `src/` tree (37 pages, ~13.5K LOC). The shell, sidebar, Activity Drawer, Smart Search 3-pane, and Profile living-card are already in. Real problems remaining:

**A. Inconsistency**
- 37 pages, but only ~13 wrap in `AppShell`. The rest (Blog, Pricing, About, Help, Careers, Pricing, KnowledgeHub, ReviewQueue, AdvisorDashboard, PredictiveAnalytics, ExtensionOnboarding, ComponentShowcase, InterviewBoard, InterviewPrep partly) still use old `Layout` or no layout → visual whiplash.
- `index.css` still loads **Inter + JetBrains Mono via fontsource** even though the user asked for Apple SF stack. Inter imports should go.
- Several pages bypass tokens (raw `text-white`, `bg-black`, hardcoded hex in InterviewBoard, CareerRoadmap, Dashboard hero).
- Loading/empty/error states missing on Dashboard, JobSearch results, AutoPilot, ReviewQueue → blank screens on slow networks.

**B. Missing power-user surface**
- No global Command Palette (⌘K) — every competitor (Teal, Huntr, Linear) ships one. It's the single biggest leverage point for a multi-product app.
- No keyboard shortcuts (`g d` dashboard, `g j` jobs, `c` new application, `/` focus search).
- No global notifications/inbox center — Activity Drawer covers automation only.

**C. Pipeline & tracking gaps (the Huntr/Teal table-stakes)**
- No Kanban application pipeline (Saved → Applied → Interview → Offer → Rejected). Dashboard mentions it in plan but isn't built.
- No "Today's focus" daily card on Dashboard.
- No saved-search / alert UI even though plan mentions it.
- No quick "log a contact" / networking CRM mini-view.

**D. Onboarding still heavy**
- `Onboarding.tsx` is 298 lines; needs the 3-step skip-friendly flow promised.

**E. Mobile**
- Sidebar collapses but Smart Search 3-pane and Profile tabs are unusable <768px (current viewport is 384px). Needs mobile bottom-tabs and stacked panes.

**F. A11y / polish**
- Many interactive divs without role/tabindex.
- Focus rings inconsistent (some pages strip outlines).
- No skip-to-content link.
- Color contrast on muted text in dark theme is borderline (AA fail in a few spots).

**G. Discoverability of AI**
- AI features hide behind text buttons. Competitors lead with a persistent "Ask AI" / sparkle button. We have an `ActivityButton` but no "ask" entry point.

## 2. Competitive read (web research)

| Tool | Why it wins | What we should steal |
|---|---|---|
| **Teal** | Resume tailoring + bookmark extension + tracker in one | Match-score visible in list, one-click "tailor resume to this JD" |
| **Huntr** | Visual Kanban pipeline, contacts CRM | Drag-drop pipeline board, contacts tab inside each job |
| **Simplify** | 1-click autofill, 200M+ apps facilitated | "Apply with autofill" CTA prominence; autopilot batch view |
| **Linear/Notion** | ⌘K palette, keyboard-first | Global palette, jump-anywhere, AI actions inline |

Our differentiator stays the **cross-product automation chain** (Optimizer → Cover → Apply → Follow-up) surfaced in the Activity Drawer — none of the competitors do this. The UI must lean into it.

## 3. Scope this iteration (frontend only, shippable)

Ordered, each piece independently mergeable:

### P0 — Foundation cleanup (1 pass)
1. Remove Inter/JetBrains-Mono fontsource imports; lock Apple SF stack (system fonts already configured).
2. Sweep remaining raw color classes in InterviewBoard, CareerRoadmap, Dashboard, Pricing, About → semantic tokens.
3. Migrate the 14 remaining pages onto `AppShell` (or keep public `Layout` for marketing pages, which is fine — list: Index, Pricing, About, Careers, Blog, BlogPost, FAQ, Contact, Terms, Privacy, Help, ExtensionOnboarding stay public; KnowledgeHub, ReviewQueue, AdvisorDashboard, PredictiveAnalytics move to `AppShell`).
4. Add global `<SkipToContent />`, restore focus rings via Tailwind ring tokens, audit contrast.

### P1 — Power surface
5. **Command Palette (`⌘K` / `Ctrl+K`)** using existing shadcn `Command`. Routes, recent jobs, "Tailor resume…", "Generate cover letter…", "Toggle theme", "Sign out". Mounts in `AppShell`.
6. **Keyboard shortcuts** layer (`useHotkeys` lightweight hook): `g d/j/p/r`, `/` focus search, `?` opens shortcut cheatsheet sheet.
7. **Notifications dropdown** in `AppShell` header (bell icon) — unifies automation done events + new job alerts; reuses `AutomationContext` for now, stub for alerts.

### P2 — Pipeline & dashboard rebuild
8. **Dashboard rebuild** to spec: Today's focus hero card, Pipeline Kanban (5 columns, drag with `@dnd-kit/core` — already common), upcoming interviews strip, roadmap progress, recent activity feed.
9. **Kanban pipeline** as a reusable component (`<ApplicationPipeline />`) used on Dashboard and a dedicated `/pipeline` route.
10. **Saved-search / alerts panel** in `JobSearch` left pane: name a search, toggle "Daily alert", list saved searches.

### P3 — Onboarding + mobile
11. **3-step Onboarding** rewrite (`Onboarding.tsx`): Upload/LinkedIn/Skip → Goal chips → Target roles autocomplete. Persist locally first; backend wiring later.
12. **Mobile**: bottom tab bar (Dashboard / Jobs / Apply / Profile) below `md`, stack Smart Search panes vertically, make Profile tabs swipeable.

### P4 — AI surface
13. **"Ask Tayari" floating button** (bottom-right, sparkle) opens a side sheet with quick AI actions scoped to current page (e.g. on a job → "Why is this a fit?", "Generate cover letter", "Practice interview"). Frontend stub now; wires into existing LLM endpoints when ready.
14. **Inline "AI tailor" buttons** standardized into one `<AiActionButton />` so every section gets the same treatment.

### Out of scope (frontend-only constraint)
- New tables, RLS, edge functions, Hermes provider work, payments, real alert delivery — all backend; deferred.

## 4. Component additions

```
src/components/
  command/CommandPalette.tsx          (P1)
  command/useHotkeys.ts               (P1)
  notifications/NotificationsBell.tsx (P1)
  pipeline/ApplicationPipeline.tsx    (P2)
  pipeline/PipelineCard.tsx           (P2)
  jobs/SavedSearches.tsx              (P2)
  ai/AskTayariButton.tsx              (P4)
  ai/AiActionButton.tsx               (P4)
  layout/MobileTabBar.tsx             (P3)
  a11y/SkipToContent.tsx              (P0)
```

## 5. Order of execution & checkpoints

P0 → smoke test all routes render → P1 (palette + shortcuts visible win) → P2 (dashboard reveal) → P3 (mobile + onboarding) → P4 (AI surface). Stop after each P# for review.

## 6. Risk / trade-offs

- ⌘K + hotkeys: minor risk of intercepting browser shortcuts; we'll scope to non-conflicting keys.
- Kanban DnD library adds ~25KB gzipped; acceptable.
- Mobile bottom-tab adds duplicated nav surface; we hide sidebar trigger below `md` to avoid two navs.

---

**Approve and I start at P0. Or tell me to reshuffle priorities / drop a phase / add something.**
