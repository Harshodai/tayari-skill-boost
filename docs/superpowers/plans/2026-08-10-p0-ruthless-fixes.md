# P0 Ruthless Fixes — Job Tayari (brand, optimizer data flow, career goal)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three P0 gaps found in the ruthless audit: single product name everywhere, every resume-optimizer input reaching the engine, and the career goal persisted in the canonical profile.

**Architecture:** Copy-level brand convergence (no internal renames); forward `custom_instructions`/`target_role`/`jd_url` through Python → Go → frontend; add career-goal columns to `public.profiles` + sync to self-hosted Supabase.

**Tech Stack:** React/TS/Vite, Go/Chi, Python/FastAPI, Supabase (self-hosted).

## Global Constraints

- `// ponytail:` minimal-change rule — surgical edits only; every non-obvious choice gets `// ponytail: <why>` (Go/TS) or `# ponytail: <why>` (Python). Never rewrite code not in scope.
- Route parity — every `/api/v1/...` route needs the legacy `/api/...` alias and vice versa (asserted by `router_parity_test.go`).
- DB migration sync — every change under `backend/db/migrations/` MUST be copied to `supabase-local/volumes/db/init/` with the next `NN-` prefix AND mounted individually in `supabase-local/docker-compose.yml` under the `db:` service.
- Mock ≠ passing — a green test against mocks does not prove the wire; verify against the real stack where the task says so.
- No `manualChunks` in `vite.config.ts`.
- `JWT_SECRET` + `POSTGRES_PASSWORD` identical across root `.env` and `supabase-local/.env`.
- Never `docker compose down -v` or `rm -rf supabase-local/volumes/db/data`.
- Lessons capture — after each task append a dated entry to `lessons.md`.
- Product name is "Job Tayari" in all user-facing copy. "Tay" remains the companion pet's default name (intentional, user-renamable) — do NOT rename it.

---

### Task 1: Brand convergence — "Job Tayari" everywhere

**Files:**
- Modify: `src/pages/Landing.tsx:19` (change "Tayari Skill Boost" heading to "Job Tayari")
- Modify: `src/config/branding.test.ts` (add assertions: no "Tayari Skill Boost" product-name usage in src/ outside test files; index.html title contains "Job Tayari")
- Verify-only (no change): `index.html` (already "Job Tayari"), `src/components/Logo.tsx` (already "JobTayari" as two spans), `src/components/pet/TayariPet.tsx` ("Tay" is the pet's default name — keep)
- Modify: `src/pages/NotFound.tsx` (wrap in `Layout` from `@/components/layout`, branded copy, two CTAs: "Back to dashboard" → `/dashboard`, "Contact support" → `/contact`)

**Interfaces:**
- Consumes: `Layout` from `@/components/layout` (named export, `children` + optional `showFooter`).
- Produces: branded 404 inside Layout; branding test locks "Job Tayari" as the single product name.

- [ ] **Step 1: Write the failing test**

Extend `src/config/branding.test.ts` with a new describe block:

```ts
describe("branding: Job Tayari is the single product name (P0)", () => {
  const productNameOffenders = sourceFiles(SRC).filter(
    (f) => !/\.test\.(ts|tsx)$/.test(f) && /Tayari Skill Boost/.test(readFileSync(f, "utf8"))
  );

  it("no user-visible 'Tayari Skill Boost' remains in src/", () => {
    expect(productNameOffenders.map((f) => f.replace(SRC, ""))).toEqual([]);
  });

  it("index.html title uses Job Tayari", () => {
    const html = readFileSync(join(SRC, "..", "index.html"), "utf8");
    expect(html).toContain("<title>Job Tayari");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test --dom --preload ./src/test/setup.ts src/config/branding.test.ts`
Expected: FAIL — `src/pages/Landing.tsx` contains "Tayari Skill Boost".

- [ ] **Step 3: Minimal implementation**

`src/pages/Landing.tsx:19` — change `Tayari Skill Boost` to `Job Tayari` (keep surrounding markup identical).

`src/pages/NotFound.tsx` — replace the bare `<a>` page with a Layout-wrapped branded version:

```tsx
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-6xl font-bold">404</h1>
        <p className="mb-8 text-xl text-muted-foreground">This page drifted off the map.</p>
        <div className="flex gap-3">
          <Link to="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline">Contact support</Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
```

Note: `src/App.tsx:84` lazy-imports `./pages/NotFound` as default export — keep `export default`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test --dom --preload ./src/test/setup.ts src/config/branding.test.ts`
Expected: PASS (all 4 assertions).

Run: `bun run build`
Expected: build succeeds (catches the new Layout import wiring).

Run: `bun run lint`
Expected: no new errors (baseline is 51 existing errors — do not add to them).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.tsx src/pages/NotFound.tsx src/config/branding.test.ts
git commit -m "fix(brand): single product name 'Job Tayari', branded 404 in Layout"
```

---

### Task 2: Resume optimizer — every input reaches the engine

**Files:**
- Modify: `backend/python/app/api/ai_routes.py` — `OptimizerRequest` (line ~261) gains `custom_instructions: Optional[str] = None`, `target_role: Optional[str] = None`, `jd_url: Optional[str] = None`; `optimize_resume` (line ~325) routes to `optimizer.optimize_resume_with_options()` when `jd_url` is present, else `optimize_with_reflection` with the new fields; `optimize_resume_stream` (line ~341) gains `custom_instructions` and `target_role` Form params and threads them into `optimize_with_reflection` (jd_url is regular-path-only — not part of the streaming Form contract; documented limitation).
- Modify: `backend/python/app/main.py` — `OptimizerRequest` (line ~253) same three fields; `optimize_resume` (line ~259) same routing; `optimize_resume_stream` (line ~275) same custom_instructions + target_role Form fields.
- Modify: `backend/go/internal/api/routes_mvp.go::handleOptimizeResume` (line ~926) — request struct gains `CustomInstructions`, `TargetRole`, `JdURL` (`json:"custom_instructions,omitempty"` etc.); forward all to Python.
- Modify: `src/api/resumes.ts::optimizeResume` (line ~77) — signature `optimizeResume(id: string | number, opts?: { jobDescription?: string; customInstructions?: string; targetRole?: string; jdUrl?: string })`; body sends `job_description`, `custom_instructions`, `target_role`, `jd_url`.
- Modify: `src/pages/ResumeUpload.tsx` — `navigate("/resume/results", { state: ... })` (line ~139) also passes `customInstructions` and `jobPostUrl`; `canAnalyze` (line ~158) relaxes to `(resumeText || resumeFile) && (jobDescription.trim().length > 50 || customInstructions.trim().length > 0) && !parsingError`.
- Modify: `src/pages/ResumeResults.tsx` — read `customInstructions` and `jobPostUrl` from `location.state` (lines ~56-58); `handleOptimize` (line ~88) calls `optimizeResume(resumeId, { jobDescription, customInstructions, targetRole, jdUrl })` where `targetRole` stays undefined unless a source exists.

**Interfaces:**
- Consumes: `optimizer.optimize_with_reflection(resume_text, job_description=..., target_role=..., job_label=..., custom_instructions=...)` (already supports all fields); `optimizer.optimize_resume_with_options(resume_text="", file_bytes=None, filename="", jd_text="", jd_url="", custom_instructions="", target_role="")` (already supports `jd_url` scraping with Playwright fallback).
- Produces: HTTP contract where `POST /api/v1/optimizer/optimize` accepts `{resume_text, job_description, custom_instructions, target_role, jd_url}` and the UI round-trips them. Streaming coverage asserts custom_instructions + target_role reach `optimize_with_reflection`; jd_url streaming is a documented limitation, not a gap.

- [ ] **Step 1: Write the failing tests**

Python test (append to `backend/python/app/tests/test_optimizer_enhanced.py` or a new test):

```python
import pytest
from app.api.ai_routes import OptimizerRequest


def test_optimizer_request_accepts_all_inputs():
    req = OptimizerRequest(
        resume_text="resume",
        job_description="jd",
        custom_instructions="emphasize leadership",
        target_role="Senior Engineer",
        jd_url="https://boards.greenhouse.io/example",
    )
    assert req.custom_instructions == "emphasize leadership"
    assert req.target_role == "Senior Engineer"
    assert req.jd_url == "https://boards.greenhouse.io/example"
```

Go test — append to `backend/go/internal/api/routes_resume_import_test.go` (mirror existing pattern; name test `TestOptimizeResumeForwardsCustomInstructions`): assert `handleOptimizeResume` accepts a body with `custom_instructions` and forwards it to the Python upstream (stub the AI client, assert the received payload contains the field).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend/python && pytest app/tests/test_optimizer_enhanced.py::test_optimizer_request_accepts_all_inputs -v`
Expected: FAIL — `OptimizerRequest.__init__()` got unexpected keyword arguments.

- [ ] **Step 3: Minimal implementation**

Python `ai_routes.py`:

```python
class OptimizerRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None
    custom_instructions: Optional[str] = None
    target_role: Optional[str] = None
    jd_url: Optional[str] = None
```

`optimize_resume`:

```python
    try:
        if payload.jd_url:
            # ponytail: jd_url path routes through the scraper-backed options
            # entry point; the plain reflection path has no URL handling.
            result = await optimizer.optimize_resume_with_options(
                resume_text=payload.resume_text,
                jd_text=payload.job_description or "",
                jd_url=payload.jd_url,
                custom_instructions=payload.custom_instructions or "",
            )
        else:
            result = await optimizer.optimize_with_reflection(
                payload.resume_text,
                job_description=payload.job_description,
                target_role=payload.target_role,
                custom_instructions=payload.custom_instructions,
            )
        return result
```

`optimize_resume_stream` — add `custom_instructions: Optional[str] = Form(None)` and `target_role: Optional[str] = Form(None)` params and thread both into the `optimize_with_reflection` call (jd_url stays regular-path-only — not part of the streaming Form contract).

Same three changes in `backend/python/app/main.py` (duplicate definitions — keep both in sync; ponytail comment: two files because main.py registers the app while ai_routes is the mounted router).

Go `handleOptimizeResume` — request struct:

```go
	var req struct {
		JobDescription     string `json:"job_description,omitempty"`
		CustomInstructions string `json:"custom_instructions,omitempty"`
		TargetRole         string `json:"target_role,omitempty"`
		JdURL              string `json:"jd_url,omitempty"`
	}
```

and the PostJSON body gains all four keys.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/python && pytest app/tests/test_optimizer_enhanced.py -v`
Expected: PASS.

Run: `cd backend/go && go test ./internal/api/... -run TestOptimize -v`
Expected: PASS.

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add backend/python/app/api/ai_routes.py backend/python/app/main.py backend/go/internal/api/routes_mvp.go backend/go/internal/api/routes_resume_import_test.go backend/python/app/tests/test_optimizer_enhanced.py src/api/resumes.ts src/pages/ResumeUpload.tsx src/pages/ResumeResults.tsx
git commit -m "feat(optimizer): forward custom_instructions, target_role, jd_url through Python/Go/UI"
```

---

### Task 3: Career goal persisted in canonical profile

**Files:**
- Create: `backend/db/migrations/20260810_01_career_goal.sql`
- Create: `supabase-local/volumes/db/init/22-20260810_career_goal.sql`
- Modify: `supabase-local/docker-compose.yml` (add `22-` mount after line 276)
- Modify: `backend/go/internal/models/profile.go` — `TransitionType`, `CurrentTitle`, `TargetLevel`, `CurrentIndustry`, `TargetIndustry`, `TransferableSkills` fields
- Modify: `backend/go/internal/api/routes_mvp.go` — `handleGetProfile` SELECT/scan/map and `handleUpdateProfile` INSERT/upsert (lines ~34-115) include the new columns
- Modify: `src/api/types.ts` — `Profile` interface gains the six optional fields
- Modify: `src/pages/Profile.tsx` — form state + Career Goal card with branch selector + conditional inputs; load/save the fields
- Modify: `src/pages/Onboarding.tsx` — `finish()` awaits `updateProfile()` — on failure, keep the user on the current step, show an inline error, and allow retry (no navigation); navigate to `/dashboard` only after the canonical profile write succeeds. `localStorage` + `pet_preferences` mirror stays best-effort secondary storage.

**Interfaces:**
- Consumes: `updateProfile(payload: Partial<Profile>)` from `@/api` (PUT /v1/profile); `models.Profile` JSON tags.
- Produces: `GET /api/v1/profile` returns `transition_type` etc.; PUT round-trips them; self-hosted Supabase creates the columns.

- [ ] **Step 1: Write the failing test**

Go test — append to an existing profile route test file (or create `backend/go/internal/api/routes_profile_test.go` if none exists; check first): test that `handleUpdateProfile` accepts `transition_type: "cross_domain"` and `handleGetProfile` returns it.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — unknown column in query or response lacks the field.

- [ ] **Step 3: Minimal implementation**

Migration SQL:

```sql
-- 2026-08-10: career goal persistence (P0 audit fix Q3)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS transition_type TEXT CHECK (transition_type IN ('same_domain', 'cross_domain')),
    ADD COLUMN IF NOT EXISTS current_title TEXT,
    ADD COLUMN IF NOT EXISTS target_level TEXT,
    ADD COLUMN IF NOT EXISTS current_industry TEXT,
    ADD COLUMN IF NOT EXISTS target_industry TEXT,
    ADD COLUMN IF NOT EXISTS transferable_skills TEXT[] DEFAULT '{}';
```

Sync: copy to `supabase-local/volumes/db/init/22-20260810_career_goal.sql`; add mount in `supabase-local/docker-compose.yml`:

```yaml
      - ./volumes/db/init/22-20260810_career_goal.sql:/docker-entrypoint-initdb.d/migrations/zz-22-20260810_career_goal.sql:Z
```

Go model fields (JSON tags snake_case matching existing style), handler query/scan/upsert updated — the profile round-trip test proves the wire.

`Profile.tsx`: add to form state and the useEffect load; add a "Career Goal" card with a two-button branch selector (`same_domain` / `cross_domain`) plus conditional inputs (current_title, target_level, current_industry, target_industry, transferable_skills); include in the updateMutation payload.

`Onboarding.tsx`: in `finish()`, after localStorage write, `await updateProfile({ transition_type: transitionType, current_title, target_level, current_industry, target_industry, transferable_skills })`; on failure keep the user on the current step with an inline error and allow retry — no navigation. Navigate to `/dashboard` only after the canonical profile write succeeds; the `localStorage` + `pet_preferences` mirror remains best-effort secondary storage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/go && go test ./internal/api/... -run TestProfile -v`
Expected: PASS.

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/20260810_01_career_goal.sql supabase-local/volumes/db/init/22-20260810_career_goal.sql supabase-local/docker-compose.yml backend/go/internal/models/profile.go backend/go/internal/api/routes_mvp.go src/api/types.ts src/pages/Profile.tsx src/pages/Onboarding.tsx
git commit -m "feat(profile): persist career transition goal in canonical profile"
```

---

### Task 4: Backend brand string cleanup (Task 1 review follow-up)

**Files:**
- Modify: `backend/go/internal/api/routes_mvp.go:2036` — `platform_name` value "Tayari Skill Boost Candidate Intelligence Suite" → "Job Tayari Candidate Intelligence Suite"
- Modify: `backend/python/app/services/agent_reach.py:69,187` — same `platform_name` values → "Job Tayari ..."
- Modify: `backend/python/app/export/pipeline_dashboard_generator.py:34` — exported HTML title "Tayari Skill Boost — Pipeline Analytics" → "Job Tayari — Pipeline Analytics" (user-visible in exported PDFs)

**Interfaces:**
- Consumes: the Task 1 branding gate (src/ + index.html) is already green; this closes the backend leak the gate cannot see.
- Produces: no backend payload emits the stale product name.

- [ ] **Step 1: Write the failing test**

Go test asserting the `platform_name` in the agent-reach doctor response no longer contains "Tayari Skill Boost" (append to the existing agent-reach route test if one exists, else a focused test on `handleAgentReachDoctor`); Python test asserting `agent_reach.py` platform_name strings are "Job Tayari".

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — stale string present.

- [ ] **Step 3: Minimal implementation**

Copy-level value swap only (these are data payloads, not identifiers — no import/route changes). Add `// ponytail:` / `# ponytail:` comments noting the brand gate lives in `src/config/branding.test.ts` and this backend value is currently unrendered but must stay in sync.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend/go && go test ./internal/api/... -run TestAgentReachDoctor -v`; `cd backend/python && pytest app/tests/test_agent_reach.py -v` (adjust to actual test file names). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/go/internal/api/routes_mvp.go backend/python/app/services/agent_reach.py <test files>
git commit -m "fix(brand): backend platform_name payloads use 'Job Tayari'"
```
