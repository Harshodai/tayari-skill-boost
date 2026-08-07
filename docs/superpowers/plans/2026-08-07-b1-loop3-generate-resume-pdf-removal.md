# B1 loop-3: generate-resume-pdf edge fn → Go/Python (Typst-only, local)

**Status:** IN PROGRESS (planned 2026-08-07)

## Context & goal

Third and final edge fn in the split-brain-backend blocker. `supabase/functions/generate-resume-pdf/` (804 lines) does:
1. LLM-optimize resume text (Lovable AI gateway, gemini-3-flash)
2. LLM-convert to LaTeX using 6 hardcoded preambles (modern/professional/creative/minimal/tech/executive)
3. Compile via **third-party** services (latexonline.cc primary, latex.ytotech.com fallback) with up to 3 attempts + AI error-fix loop
4. PII consent gate: 451 `third_party_consent_required` unless `acceptThirdPartyCompilation: true`

**Verified facts (recon 2026-08-07):**
- **No UI call site passes `acceptThirdPartyCompilation`** (grep src/ = 0 hits) → both modal buttons (`ResumePreviewModal.tsx:67` LaTeX preview, `:102` Download PDF) currently fail with 451. The feature is broken today; the consent UX does not exist. Removing the gate removes nothing users can do.
- The two invoke sites also pass `parsedResume` + `previewOnly` in the body — **the fn ignores both** (not in its request interface or destructure). `previewOnly` is dead.
- Python already has `typst_exporter.py` (6 templates + `executive` alias, `_sanitize_typst`, `compile_typst_to_pdf` w/ typst CLI → PDFExporter fallback) and `POST /api/v1/export/typst-pdf` + `/api/export/typst-pdf` (main.py:814-829, `TypstExportRequest{profile_data: dict, template}`). typst v0.15.1 binary installed in the python container (Dockerfile:20-31, live-verified).
- Exporter consumes a **profile dict** (`full_name`/`email`/`phone`/`summary`/`skills[]`/`experience[{title,company,dates,bullets[]}]`/`education[{degree,school,year}]`).
- Go↔Python binary contract: **base64 in JSON** (`routes_mvp.go:773-774`, docx export pattern — Python returns JSON, Go `base64.StdEncoding.DecodeString`).
- `supabase/config.toml` has only `[functions.check-breached-password]` — no block to strip (like loop-2).
- Modal caller: `ResumeTemplates.tsx:380` — receives `parsedResume`, `resumeText`, `jobDescription`, `appliedSuggestions`, `template`, `templateName`, `resumeFileName`, `analysisResults` (UI type `ResumeAnalysisResult`: overallScore, sections[], matchedKeywords, missingKeywords, summaryRecommendation).
- LaTeX-specific UI surface: `LaTeXSourceView.tsx` (tab content), "LaTeX Source" tab + "Download LaTeX" button in the modal. Typst-only ⇒ no LaTeX source exists ⇒ this surface is removed.

**User decision:** Typst-only, local compilation. No PII leaves the stack; consent gate deleted. Matches the self-hostable positioning.

## Approach

One Python endpoint replaces the whole edge fn pipeline:
- **LLM optimize (1 call, JSON in/out)**: port the edge fn's `generateOptimizedContent` intent — input: resume text, analysis summary (overall score, missing keywords, summary recommendation), applied suggestions, optional job description. Output: optimized **profile dict** (the exporter's native input) — skeleton from `parsedResume` (contact/section structure), LLM rewrites summary/experience bullets/skills per suggestions + missing keywords. The edge fn's step-2 (LLM→LaTeX) and step-3 (compile + retry/fix loop) **disappear entirely** — Typst compilation is deterministic and local; no escaping, no error-fix loop.
- **Render**: existing `generate_typst_code(profile_data, template)` + `compile_typst_to_pdf`.
- **Template mapping** (UI names → exporter names): `modern→modern_tech`, `professional→executive_slate`, `creative→creative_compact`, `minimal→minimalist_ats`, `tech→faang_single_page`, `executive→executive`. (Fidelity judgment call; documented in a table in the endpoint.)
- **Return**: JSON `{"pdf_base64": ...}` (docx pattern) — NOT StreamingResponse, so Go can proxy it without binary passthrough.
- **No consent gate** — PII stays in our stack (LLM provider + local typst).

## Tasks (SDD, TDD per task)

### Task 1 — Python: `POST /api/v1/resumes/generate-pdf` (+ `/api/resumes/generate-pdf` alias)
Contract (Pydantic `GenerateResumePdfRequest`):
- `resume_text: str` (size-guarded ≤50k)
- `profile_data: dict` (parsedResume, used as skeleton + mapped to exporter keys)
- `analysis: dict` (UI `ResumeAnalysisResult` → fields: `overall_score`, `missing_keywords[]`, `summary_recommendation`; derived from `overallScore`/`missingKeywords`/`summaryRecommendation`)
- `applied_suggestions: list[str]` (≤50)
- `job_description: str | None` (≤20k)
- `template: str` (UI name, default `professional`)
Flow: `llm_json` optimize → map profile keys → `generate_typst_code` → `compile_typst_to_pdf` → base64 JSON. Errors: 503 `ai_service_unavailable` propagation on `LLMNotConfiguredError`; 400 on missing fields.
Tests (pure, no LLM): template map covers all 6 UI names; key mapping (startDate+endDate→dates, description+achievements→bullets, degree+institution→degree/school); base64 output round-trip; 503 on unconfigured LLM (mock `llm_json`).

### Task 2 — Go: `POST /api/resumes/generate-pdf` + `/api/v1/resumes/generate-pdf` (parity)
Auth middleware (tenant), size guards mirror Python limits, forward via `s.AI.PostJSON("/api/v1/resumes/generate-pdf", ...)`, return `{"pdf_base64": ...}` passthrough (docx pattern, routes_mvp.go:760-780). Test: parity registration + passthrough shape.

### Task 3 — Frontend: rewire `ResumePreviewModal` to Go path; drop LaTeX surface
- New `src/api/resumes.ts` helper `generateResumePdf(payload)` → POST `/v1/resumes/generate-pdf`.
- Modal: both invoke sites → helper; remove consent-related handling; **remove "LaTeX Source" tab, `LaTeXSourceView`, "Download LaTeX" button** (Typst-only); Download PDF decodes `pdf_base64` (existing decode code at :127-140 stays).
- Types: remove `GenerateResumeResponse` usage in modal (keep type removal to the modal + types file only if nothing else references it — check `LaTeXSourceView.tsx` consumers).
- Delete `LaTeXSourceView.tsx` if no other consumers (grep first).
- Static test (readFileSync, no imports): no `functions.invoke("generate-resume-pdf")`, no `LaTeXSourceView`, no `acceptThirdPartyCompilation` in `src/components/resume/`.

### Task 4 — Delete `supabase/functions/generate-resume-pdf/` (1 file, 804 lines)
Grep for `generate-resume-pdf` + `GenerateResumeResponse` references across repo; only docs/comments allowed to remain. No config.toml change needed.

## Verification (after all tasks)
1. `go test ./internal/api -run TestRouteParity` + full `go test ./...`
2. `python -m py_compile` on changed files; `pytest` on new Python tests
3. `bun run build`; `bun test` on new frontend tests
4. Live: `curl -X POST localhost:8085/api/v1/resumes/generate-pdf` (auth) → base64 decodes to `%PDF-`; template=executive and template=tech both compile; unauthed → 401
5. Grep: zero `generate-resume-pdf` refs in `src/` + `backend/`
6. lessons.md entry + SDD ledger close + plan CLOSED (after review)

## Risks
- LLM JSON output malformed → validate + retry once with repair prompt, else 422 with `error: "llm_output_invalid"` (no silent fallback).
- Exporter fidelity vs old LaTeX templates — accepted (user chose Typst-only); template mapping documented.
- `LaTeXSourceView` may have other consumers → grep gates deletion.
- Frontend pre-existing lint baseline (51 errors) — new code must not add to it.

## Chain (expected)
plan → feat(python) → feat(go) → fix(ui) → chore(supabase) → docs(close)

## Status: CLOSED (2026-08-07)

All 4 tasks complete via subagent-driven development (see `.superpowers/sdd/progress.md`):
- Chain: 8e7dcda plan → b4c261d feat(python) → c2c4a89 feat(go) → 99e8e9d fix(go, stray Content-Disposition revert) → 92ada2b fix(ui) → 5846600 chore(delete) → 11735db fix(final-review findings)
- Final whole-branch review: NOT ready → 1 Critical (camelCase↔snake_case analysis payload mismatch silently dropped the analysis signal) + 1 Important (null profile_data → 422→502) + 1 Minor (dead type). Fix wave resolved all; re-review: Ready to merge, no issues.
- Live-verified: unauthed 401; authed 200, pdf_base64 decodes to %PDF- (executive + tech templates); parity green; all services healthy post-rebuild.
- The consent gate was dead code (no UI call site ever passed acceptThirdPartyCompilation) — PDF download was already broken; this loop restored it.

B1 blocker (3 edge fns → Go/Python) is now fully closed across loops 1-3.
