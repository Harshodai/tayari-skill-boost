# Tayari MVP — Subagent Coordination Spec

## Objective
Cross-pollinate askmukthiguru architectural skills (eval datasets, pipeline stages, guardrails) into Tayari to make it a world-class product. Complete all remaining integration and validation.

## Current State (DONE by main agent)
- All archive Python AI services ported (optimizer, job_agent, automation_engine, ats_engine, docx_builder, llm_service)
- All Go backend API routes added (profile, job search, autopilot, applications, schedules, resume enhancements)
- All frontend pages built (JobSearch, AutoPilot, InterviewBoard, Profile, Dashboard, ResumeResults)
- Archive test suite compatibility gaps fixed (response formats, route aliases, multipart upload, dashboard stats, etc.)
- Python ATS engine returns `ats_score` and `category_scores` aliases for archive compatibility
- Go backend handles LogEntrySlice for autopilot logs with step/message objects

## Remaining Work (3 subagents)

### Agent 1 — Eval & Quality Benchmarks
**Owner:** `eval-datasets`
**Task:** Create evaluation datasets and quality benchmarks for Tayari AI services
**Read from:** `/Users/harshodaikolluru/Public/askmukthiguru-8119b0e8/MULTI_GURU_ONBOARDING.md` (eval dataset pattern)
**Write to:** `/Users/harshodaikolluru/Public/tayari-skill-boost/backend/python/eval/`
**Deliverables:**
1. `eval/datasets/resume_optimization_v1.yaml` — 50 stratified test cases for resume optimization
2. `eval/datasets/ats_scoring_v1.yaml` — 30 test cases for ATS scoring accuracy
3. `eval/datasets/job_matching_v1.yaml` — 30 test cases for job matching relevance
4. `eval/runner.py` — pytest-compatible evaluation runner that runs each dataset against local endpoints
5. `eval/README.md` — documentation for running benchmarks and interpreting scores

### Agent 2 — Pipeline Quality Gates & Guardrails
**Owner:** `pipeline-guardrails`
**Task:** Add quality gates and guardrails to the resume optimization pipeline (inspired by askmukthiguru's architecture audit patterns)
**Read from:** `/Users/harshodaikolluru/Public/askmukthiguru-8119b0e8/ARCHITECTURE_AUDIT.md` (pipeline stage pattern)
**Write to:** `/Users/harshodaikolluru/Public/tayari-skill-boost/backend/python/app/guardrails/`
**Deliverables:**
1. `guardrails/__init__.py` — guardrail module init
2. `guardrails/truthfulness.py` — hallucination detector: verify optimized resume doesn't invent employers, titles, dates, credentials
3. `guardrails/keyword_stuffing.py` — detect keyword stuffing: flag if keywords appear >3× density or in unnatural contexts
4. `guardrails/ats_compatibility.py` — verify ATS-safe formatting: no tables, no images, standard sections present
5. `guardrails/gate.py` — PipelineGate class that runs all guardrails and returns pass/fail with reasons
6. `guardrails/README.md` — documentation for quality gate usage

### Agent 3 — Integration Testing & Final Polish
**Owner:** `integration-testing`
**Task:** Build end-to-end integration tests and a deployment checklist
**Read from:** Current code in `/Users/harshodaikolluru/Public/tayari-skill-boost/`
**Write to:** `/Users/harshodaikolluru/Public/tayari-skill-boost/tests/` and frontend polish
**Deliverables:**
1. `tests/integration/backend_test.py` — Python-based integration test that exercises all backend endpoints (adapted from archive test suite)
2. `tests/README.md` — how to run integration tests
3. Frontend: ensure `/api` URLs are used consistently in all frontend API calls (not `/v1` for archive-compatible routes)
4. Frontend: add loading states and error handling for all AI endpoints (optimizer, job search, autopilot)
5. `DEPLOYMENT_CHECKLIST.md` — step-by-step deployment guide for local and production

## Shared Contracts (DO NOT BREAK)
- Python backend port: 8000
- Go backend port: 8080
- Frontend dev server: 5173
- API base: `http://localhost:8080/api`
- All archive routes must remain functional
- Database schema already committed

## Validation Rules
- Each agent must run `python -m py_compile` on any Python files they create
- Each agent must verify their code doesn't break existing imports
- Frontend changes must not break existing route structure
