# 0003 — Supabase edge functions are not authoritative; Go/Python is the backend

Date: 2026-08-07

## Status
Accepted. All three edge functions removed (B1 loops 1-3); the dead `/api/v1/export/pdf`
duplicate routes removed in a follow-up sweep the same day.

## Context
Three Supabase edge functions (check-rate-limit, analyze-resume, generate-resume-pdf)
proxied to Lovable's AI gateway (gemini-3-flash) and stored data directly, while the Go
gateway + Python AI engine existed as a parallel self-hosted path. Two contracts existed
for every feature, gated on `VITE_USE_SELF_HOSTED` (default false, so the edge functions
were the default path). Consequences:

- Response-shape drift between paths went invisible: the analyze-resume normalizer read
  a legacy shape and rendered 0% scores in self-hosted mode.
- The generate-resume-pdf consent gate (`acceptThirdPartyCompilation`) was never set by
  any UI call site, so PDF download was already broken with 451 — the feature was dead
  while looking live.
- Resume PII (LaTeX source) left the stack via third-party compilation services.

## Decision
- The Go gateway (auth + DB + proxy) and Python AI engine (LLM + exports) are the ONLY
  backend. Supabase provides identity (GoTrue) + Postgres; its edge-function layer is not
  used.
- Per-feature replacements (B1 loops 1-3):
  - check-rate-limit → Go `POST /api/v1/auth/rate-limit` (email in JSON body;
    unauthenticated pre-login read; public IP limiter caps abuse) + frontend helper.
  - analyze-resume → Python `analyze_text_endpoint` (already existed) + frontend-only
    parity fix (`src/lib/resumeAnalysis.ts` normalizer; snake_case result contract).
  - generate-resume-pdf → Python `POST /api/v1/resumes/generate-pdf` (one `llm_json`
    call → `OptimizedProfile` → Typst render locally → `{"pdf_base64"}`) + Go proxy
    route + frontend payload builder.
- PDF compilation is Typst-only and local; the third-party LaTeX path and its consent
  gate are deleted (user decision, 2026-08-07). `PDFExporter` remains only as the
  binary-missing fallback inside the Typst pipeline — the standalone `/export/pdf`
  routes are removed. No third-party compilation service is involved in PDF
  generation.
- The LLM provider chain is the repo-standard `build_provider()` (Ollama/OpenRouter/
  NVIDIA; unconfigured → explicit 503 `ai_service_unavailable`, never silent mock).
  LLM data handling therefore depends on the configured provider: with Ollama it
  stays local, but hosted providers such as OpenRouter or NVIDIA receive the
  request payloads (resume/JD text) for inference.

## Consequences
- One contract per feature. Route parity (`/api` ↔ `/api/v1`) enforced by
  `TestRouteParity_BidirectionalAliases`. Binary data moves as base64-in-JSON.
- Frontend static tests (readFileSync) ban resurrecting `functions.invoke` patterns.
- Hosted deploys must set `VITE_API_URL` to the Go gateway (baked at build time;
  `VITE_*` are build args).
- No PII leaves the stack on the PDF compilation path (Typst is local). LLM
  inference is separate: payloads reach whichever provider `build_provider()`
  selects — local Ollama, or external providers such as OpenRouter/NVIDIA.
