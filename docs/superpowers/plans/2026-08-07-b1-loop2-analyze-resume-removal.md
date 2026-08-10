# B1 Loop 2 — `analyze-resume` Edge Function Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the `analyze-resume` Supabase edge function and make the Go→Python analysis path the only path, fixing the response-shape bug that makes the self-hosted flow render a 0% score.

**Architecture:** The edge fn is only called from `ResumeUpload.tsx`'s cloud branch (`!USE_SELF_HOSTED` — the default). The Go/Python path already exists end-to-end (`POST /v1/analyze` → Go `handleAnalyzeText` resolves owned `resume_id`/`jd_id` from DB → Python `analyze_text_endpoint` → `analyze_resume()`). Two gaps: (1) the frontend normalizer expects a legacy shape (`score`/`breakdown`/`keywords`) that Python no longer returns (it returns `overall_score`/`section_scores`/`matched_keywords`…) → UI shows 0%; (2) the edge fn's `aiOptions` focus-area steering has no equivalent. Fix both frontend-side in a pure lib module (no Python/Go changes), then delete the edge fn.

**Tech Stack:** TypeScript (React/Vite/Bun), no new dependencies.

## Global Constraints

- Route parity invariant: any route touched must stay registered under both `/api/` and `/api/v1/` (Go `TestRouteParity_BidirectionalAliases` enforces). **No route registration changes in this loop** — both analyze routes already exist with both prefixes (`routes_app.go:70` + `routes_app.go:148`).
- `// ponytail:` comment style on non-obvious choices (Go + TS both use it).
- No new dependencies. TDD for new logic. Frequent commits (conventional style, e.g. `fix(ui): …`).
- Managed files rule: never hand-edit Lovable-managed output (`src/integrations/`, `dist/`). `supabase/functions/_shared/` is shared by remaining edge fns — keep it.
- `bun run test` baseline: pre-existing failures in `external_repos/cognee` + `src/config/features.test.ts` + a `mock.module("@/api")` leak from `ResumeGraph.test.tsx` are NOT caused by this loop. New tests must not import `@/api` or React component modules (dodges the leak).
- Python rules (`backend/python/CLAUDE.md`): `python -m py_compile` gate — no Python files change in this loop.
- The `aiOptions` UI checkboxes stay (user-facing feature); they now steer the prompt via a focus-area string instead of dying with the edge fn.

---

### Task 1: Pure analysis-parity lib module (TDD)

**Files:**
- Create: `src/lib/resumeAnalysis.ts`
- Test: `src/lib/resumeAnalysis.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions; `ResumeAnalysisResult`-shaped data).
- Produces:
  - `normalizeGoAnalysis(raw: unknown): { overallScore: number; sections: { name: string; score: number; suggestions: string[] }[]; matchedKeywords: string[]; missingKeywords: string[]; summaryRecommendation: string; per_ats?: unknown }`
  - `aiOptionsToFocusText(options: { emphasizeKeywords: boolean; quantifyAchievements: boolean; optimizeFormat: boolean; tailorSummary: boolean }): string`
  - `buildAnalyzePayload(resumeId: number | string, jdId: number | string, customInstructions: string, aiOptions: { emphasizeKeywords: boolean; quantifyAchievements: boolean; optimizeFormat: boolean; tailorSummary: boolean }): { resume_id: number | string; jd_id: number | string; custom_instructions: string }`

- [x] **Step 1: Write the failing test**

`src/lib/resumeAnalysis.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { aiOptionsToFocusText, buildAnalyzePayload, normalizeGoAnalysis } from "./resumeAnalysis";

describe("normalizeGoAnalysis", () => {
  const pythonResponse = {
    result: {
      overall_score: 73,
      section_scores: { skills_match: 81.4, experience_relevance: 66.2, education_fit: 50, formatting: 90.9 },
      matched_keywords: ["React", "TypeScript"],
      missing_keywords: ["GraphQL"],
      recommendations: [
        "Add keyword React to your summary.",
        "Quantify experience bullet metrics.",
        "Improve formatting with standard headings.",
      ],
      summary: "Strong match overall; education needs work.",
    },
  };

  it("maps Python shape to the UI contract", () => {
    const result = normalizeGoAnalysis(pythonResponse);
    expect(result.overallScore).toBe(73);
    expect(result.sections.map((s) => s.name)).toEqual([
      "Skills Match",
      "Experience Relevance",
      "Education Fit",
      "Formatting",
    ]);
    expect(result.sections.map((s) => s.score)).toEqual([81, 66, 50, 91]);
    expect(result.sections[0].suggestions).toEqual(["Add keyword React to your summary."]);
    expect(result.sections[1].suggestions).toEqual(["Quantify experience bullet metrics."]);
    expect(result.sections[3].suggestions).toEqual(["Improve formatting with standard headings."]);
    expect(result.matchedKeywords).toEqual(["React", "TypeScript"]);
    expect(result.missingKeywords).toEqual(["GraphQL"]);
    expect(result.summaryRecommendation).toBe("Strong match overall; education needs work.");
  });

  it("returns zeros and empty arrays for an empty payload", () => {
    const result = normalizeGoAnalysis({});
    expect(result.overallScore).toBe(0);
    expect(result.sections).toEqual([]);
    expect(result.matchedKeywords).toEqual([]);
    expect(result.missingKeywords).toEqual([]);
    expect(result.summaryRecommendation).toBe("Analysis complete.");
  });

  it("falls back to joined recommendations when summary is absent", () => {
    const result = normalizeGoAnalysis({ result: { overall_score: 50, recommendations: ["Fix A", "Fix B"] } });
    expect(result.summaryRecommendation).toBe("Fix A Fix B");
  });

  it("passes through per_ats when present", () => {
    const result = normalizeGoAnalysis({ result: {}, per_ats: { estimates: {}, band: 5 } });
    expect(result.per_ats).toEqual({ estimates: {}, band: 5 });
  });
});

describe("aiOptionsToFocusText", () => {
  it("renders all four focus areas", () => {
    const text = aiOptionsToFocusText({
      emphasizeKeywords: true,
      quantifyAchievements: true,
      optimizeFormat: true,
      tailorSummary: true,
    });
    expect(text).toContain("keyword matching");
    expect(text).toContain("quantifiable metrics");
    expect(text).toContain("formatting improvements");
    expect(text).toContain("tailoring the resume summary");
    expect(text.startsWith("Focus areas based on user preferences:")).toBe(true);
  });

  it("returns empty string when all toggles are off", () => {
    expect(aiOptionsToFocusText({ emphasizeKeywords: false, quantifyAchievements: false, optimizeFormat: false, tailorSummary: false })).toBe("");
  });

  it("renders only the enabled subset", () => {
    const text = aiOptionsToFocusText({ emphasizeKeywords: true, quantifyAchievements: false, optimizeFormat: false, tailorSummary: false });
    expect(text).toContain("keyword matching");
    expect(text).not.toContain("quantifiable metrics");
  });
});

describe("buildAnalyzePayload", () => {
  const options = { emphasizeKeywords: true, quantifyAchievements: true, optimizeFormat: false, tailorSummary: false };

  it("combines custom instructions with focus text", () => {
    const payload = buildAnalyzePayload(7, 9, "Be concise.", options);
    expect(payload.resume_id).toBe(7);
    expect(payload.jd_id).toBe(9);
    expect(payload.custom_instructions).toContain("Be concise.");
    expect(payload.custom_instructions).toContain("Focus areas based on user preferences:");
  });

  it("returns only custom instructions when all toggles are off", () => {
    const payload = buildAnalyzePayload(7, 9, "Be concise.", { emphasizeKeywords: false, quantifyAchievements: false, optimizeFormat: false, tailorSummary: false });
    expect(payload.custom_instructions).toBe("Be concise.");
  });

  it("returns focus text when custom instructions are empty", () => {
    const payload = buildAnalyzePayload(7, 9, "", options);
    expect(payload.custom_instructions).toContain("Focus areas based on user preferences:");
    expect(payload.custom_instructions).not.toContain("\n\n\n");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/resumeAnalysis.test.ts`
Expected: FAIL with "Cannot find module './resumeAnalysis'"

- [x] **Step 3: Write the minimal implementation**

`src/lib/resumeAnalysis.ts`:

```ts
// ponytail: the Python analyze_text_endpoint returns {"result": {...}} with
// overall_score/section_scores/matched_keywords; the UI contract is
// overallScore/sections/matchedKeywords. The old normalizer read a legacy
// score/breakdown shape that Python no longer produces — that mismatch made
// every self-hosted analysis render a 0% score. This module owns the mapping
// plus the aiOptions focus-area text ported from the deleted analyze-resume
// edge function, so ResumeUpload.tsx stays a thin caller.

export interface NormalizedAnalysis {
  overallScore: number;
  sections: { name: string; score: number; suggestions: string[] }[];
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryRecommendation: string;
  per_ats?: unknown;
}

export interface AnalyzeOptions {
  emphasizeKeywords: boolean;
  quantifyAchievements: boolean;
  optimizeFormat: boolean;
  tailorSummary: boolean;
}

const SECTION_CONFIG: { name: string; key: string; filter: string }[] = [
  { name: "Skills Match", key: "skills_match", filter: "keyword" },
  { name: "Experience Relevance", key: "experience_relevance", filter: "experience" },
  { name: "Education Fit", key: "education_fit", filter: "education" },
  { name: "Formatting", key: "formatting", filter: "format" },
];

export function normalizeGoAnalysis(raw: unknown): NormalizedAnalysis {
  const payload = (raw as { result?: Record<string, unknown> })?.result ?? (raw as Record<string, unknown>) ?? {};
  const sectionScores = (payload.section_scores ?? {}) as Record<string, number>;
  const recommendations: string[] = Array.isArray(payload.recommendations)
    ? (payload.recommendations as string[])
    : [];

  const sections: { name: string; score: number; suggestions: string[] }[] = [];
  for (const cfg of SECTION_CONFIG) {
    if (sectionScores[cfg.key] === undefined) continue;
    sections.push({
      name: cfg.name,
      score: Math.round(sectionScores[cfg.key]),
      suggestions: recommendations.filter((r: string) => r.toLowerCase().includes(cfg.filter)),
    });
  }

  const overallScore = typeof payload.overall_score === "number" ? payload.overall_score : 0;
  const summary = typeof payload.summary === "string" ? payload.summary : "";
  const summaryRecommendation =
    summary || (recommendations.length > 0 ? recommendations.join(" ") : "Analysis complete.");

  return {
    overallScore,
    sections,
    matchedKeywords: Array.isArray(payload.matched_keywords) ? (payload.matched_keywords as string[]) : [],
    missingKeywords: Array.isArray(payload.missing_keywords) ? (payload.missing_keywords as string[]) : [],
    summaryRecommendation,
    per_ats: (raw as { per_ats?: unknown })?.per_ats,
  };
}

export function aiOptionsToFocusText(options: AnalyzeOptions): string {
  const parts: string[] = [];
  if (options.emphasizeKeywords) {
    parts.push("- Pay special attention to keyword matching between resume and job description. Identify specific keywords that are present and missing.");
  }
  if (options.quantifyAchievements) {
    parts.push("- Look for opportunities to add quantifiable metrics and numbers to achievements. Suggest specific ways to quantify accomplishments.");
  }
  if (options.optimizeFormat) {
    parts.push("- Evaluate formatting, structure, and readability. Suggest formatting improvements.");
  }
  if (options.tailorSummary) {
    parts.push("- Provide suggestions for tailoring the resume summary/objective to better match this specific job.");
  }
  if (parts.length === 0) return "";
  return `Focus areas based on user preferences:\n${parts.join("\n")}`;
}

export function buildAnalyzePayload(
  resumeId: number | string,
  jdId: number | string,
  customInstructions: string,
  aiOptions: AnalyzeOptions
): { resume_id: number | string; jd_id: number | string; custom_instructions: string } {
  const focus = aiOptionsToFocusText(aiOptions);
  const combined = [customInstructions, focus].filter(Boolean).join("\n\n");
  return { resume_id: resumeId, jd_id: jdId, custom_instructions: combined };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/resumeAnalysis.test.ts`
Expected: PASS (all 8 assertions green)

- [x] **Step 5: Commit**

```bash
git add src/lib/resumeAnalysis.ts src/lib/resumeAnalysis.test.ts
git commit -m "feat(lib): analysis normalizer + aiOptions focus-text mapper (Python shape parity)"
```

---

### Task 2: Rewire `ResumeUpload.tsx` to the Go path only

**Files:**
- Modify: `src/pages/ResumeUpload.tsx` (imports line 32/36; delete local `normalizeGoAnalysis` lines 41-101; `handleAnalyze` lines 161-215 keeps Go branch, delete cloud branch lines 215-~275; `analyzeResume` call at line 193 gets `buildAnalyzePayload`)

**Interfaces:**
- Consumes: `normalizeGoAnalysis`, `buildAnalyzePayload` from `@/lib/resumeAnalysis` (Task 1).
- Produces: no new interfaces; removes the last `supabase.functions.invoke("analyze-resume")` call site in the app.

- [x] **Step 1: Write the failing test**

There is no unit test that can meaningfully fail for a UI rewiring without React rendering (the logic lives in the Task-1 lib, already tested). The gate for this task is static: the cloud branch must be gone. Create `src/pages/resumeUploadNoCloud.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("ResumeUpload.tsx cloud-path removal", () => {
  const source = readFileSync(new URL("./ResumeUpload.tsx", import.meta.url), "utf8");

  it("no longer references the analyze-resume edge function", () => {
    expect(source).not.toContain("functions.invoke");
    expect(source).not.toContain("analyze-resume");
  });

  it("no longer branches on USE_SELF_HOSTED for analysis", () => {
    expect(source).not.toContain("if (USE_SELF_HOSTED)");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/pages/resumeUploadNoCloud.test.ts`
Expected: FAIL — both `functions.invoke` and `if (USE_SELF_HOSTED)` are still present.

- [x] **Step 3: Rewire the component**

In `src/pages/ResumeUpload.tsx`:

1. Line 36 import: remove `USE_SELF_HOSTED` from the `@/api` import list (keep `createResume, createJD, analyzeResume, importJobDescription, uploadResumeMultipart`).
2. Line 32: delete `import { supabase } from "@/integrations/supabase/client";` (its only uses are the invoke at line 226 and the `resume_analyses` insert at line 250, both in the cloud branch).
3. Delete the local `normalizeGoAnalysis` function (lines 41-101) and its `ResumeAnalysisResult`-related imports if they become unused (check: `ResumeAnalysisResult` is also used in the navigate `state` typing at line 209 — keep the import if used, otherwise drop).
4. Add import: `import { buildAnalyzePayload, normalizeGoAnalysis } from "@/lib/resumeAnalysis";`
5. In `handleAnalyze`, replace the `if (USE_SELF_HOSTED) {` wrapper with the Go-path body unconditionally:
   - Keep Phase 1 (upload/create resume), Phase 2 (createJD), Phase 3, Phase 4 as-is.
   - Replace the `analyzeResume({ resume_id: resumeId, jd_id: newJD.id, custom_instructions: customInstructions })` call (line 193) with:

```ts
        const result = await analyzeResume(
          buildAnalyzePayload(resumeId, newJD.id, customInstructions, aiOptions)
        );
```

   - Delete the entire cloud `else {` block (the `supabase.functions.invoke("analyze-resume")` call, the `resume_analyses` insert, and its navigation).
   - Keep the shared tail: `const normalized = normalizeGoAnalysis(result);` + navigate (already present in the Go branch).

- [x] **Step 4: Run tests + build to verify**

Run: `bun test src/pages/resumeUploadNoCloud.test.ts src/lib/resumeAnalysis.test.ts`
Expected: PASS (both files)

Run: `bun run build`
Expected: `✓ built in …s` with no TypeScript errors (watch for unused imports — delete `ResumeAnalysisResult` from the type import at line 38 if the compiler flags it as unused after the local normalizer is deleted; the navigate `state` uses `parsedResume`/`resumeFileName`/etc. from inline objects, so double-check what remains).

Run: `bun run lint`
Expected: clean (or only pre-existing warnings)

- [x] **Step 5: Commit**

```bash
git add src/pages/ResumeUpload.tsx src/pages/resumeUploadNoCloud.test.ts
git commit -m "fix(ui): analyze always via Go gateway; drop edge-fn cloud branch + resume_analyses insert"
```

---

### Task 3: Delete the `analyze-resume` edge function

**Files:**
- Delete: `supabase/functions/analyze-resume/` (whole directory: `index.ts` only)

**Interfaces:**
- Consumes: nothing. Produces: removes the last edge-fn for the B1 loop-2 surface.

- [x] **Step 1: Confirm no remaining references**

Run: `grep -rn "analyze-resume" src/ supabase/ docker-compose.yml backend/ docs/ --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.toml" --include="*.md" 2>/dev/null | grep -v "supabase/functions/analyze-resume" || echo "NO REFERENCES"`
Expected: `NO REFERENCES` — if anything other than the function dir itself matches, stop and investigate before deleting.

- [x] **Step 2: Delete the directory**

Run: `rm -rf supabase/functions/analyze-resume/`
Note: `supabase/config.toml` has NO `[functions.analyze-resume]` block (verified — only `[functions.check-breached-password]` exists), so nothing to strip there. `supabase/functions/_shared/cors.ts` stays (used by `draft-outreach`, `apply-agent`, `generate-resume-pdf`).

- [x] **Step 3: Verify the tree and tests**

Run: `git status --short` → shows only the deletion of `supabase/functions/analyze-resume/index.ts`
Run: `bun test src/pages/resumeUploadNoCloud.test.ts src/lib/resumeAnalysis.test.ts` → PASS
Run: `bun run build` → green
Run: `bun run lint` → clean

- [x] **Step 4: Commit**

```bash
git add -A supabase/functions/analyze-resume
git commit -m "chore(supabase): delete analyze-resume edge function"
```

---

## Verification (live, after all 3 tasks)

1. **End-to-end shape through the gateway** (confirms the normalizer's contract): the Go gateway is already running the current build; the Python engine is unchanged this loop, so a live probe only needs an auth token and owned records:

```bash
TOKEN=$(cat /tmp/tayari_token.txt)
curl -s -X POST localhost:8085/api/v1/analyze \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"resume_text":"Senior engineer. React, TypeScript, 5 years.","job_description":"Senior frontend engineer with React and TypeScript."}' \
  | head -c 400
```

Expected: a JSON object whose `result` key carries `overall_score`, `section_scores`, `matched_keywords`, `recommendations`, `summary` — the shape `normalizeGoAnalysis` maps. (If the LLM is unconfigured this returns 503 `ai_service_unavailable` — that's the never-mock behavior, not a regression.)

2. **Route parity stays green** (no route touched this loop, but confirm the invariant):

```bash
cd backend/go && go test ./internal/api -run TestRouteParity -v | grep -E "PASS|FAIL"
```

3. **Full frontend suite regression scope**: `bun test src/` — new tests pass; only the pre-existing baseline failures remain (`external_repos/cognee`, `src/config/features.test.ts`, the `ResumeGraph.test.tsx` `mock.module("@/api")` leak).

## Out of scope (handled elsewhere)

- `generate-resume-pdf` edge fn → loop 3.
- `apply-agent`, `draft-outreach`, `mcp` edge fns: NOT part of B1's three-loop scope (they have Go/Python equivalents in different feature areas — future work, not blockers).
- `handleListAnalysisHistory` returns hardcoded stub data (`routes_mvp.go:2014`) — pre-existing, unrelated to the split-brain fix; history persistence is a separate feature gap.
- Python `analyze_text_endpoint` itself (no changes needed this loop — the parity gap was frontend-side).

## Status: CLOSED (2026-08-07)

All 3 tasks complete via subagent-driven development (see `.superpowers/sdd/progress.md`):
- `d7d1328` feat(lib) → `8ec3286` fix(ui) → `b2c16a3` chore(supabase)
- Per-task reviews: all spec ✅ / quality approved. Final whole-branch review: ready to close; 5 Minor findings all deferred (documented in ledger).
- Live-verified: `/v1/analyze` returns the Python `result` contract (overall_score 35, 4 section_scores, matched_keywords) that `normalizeGoAnalysis` consumes; route-parity tests green; frontend/gateway/python all healthy post-rebuild.
- Pre-existing bug found & fixed en route: old normalizer read a legacy shape → self-hosted analyses rendered 0%. New lib normalizer + focus-text port pins the real contract.
