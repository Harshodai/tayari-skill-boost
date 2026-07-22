# 🚀 Tayari Skill Boost

> **The chain, not the suite.** The only job-search platform that runs the whole chain — resume to
> interview — as one observable pipeline you can watch execute, with guardrails that keep every
> application on the authentic side of the AI-vs-recruiter arms race. Self-hostable with a local LLM
> for zero marginal cost and zero data leaves-your-machine.

Tayari Skill Boost is a highly scalable, event-driven career operations platform designed to orchestrate AI-based workflows. It leverages a microservices architecture to process unstructured resume data, execute asynchronous job-scraping pipelines, and simulate Applicant Tracking System (ATS) parsing.

## 🛡️ Five differentiators no competitor ships

1. **Reflective resume optimization** (`app/services/optimizer.py`) — iterates optimization against its own scoring gate before emitting, not a single GPT pass. Competitors do one-shot GPT → template.
2. **Tiered Hermes multi-board scraping** (`app/services/hermes/`) — Tier A keyless ATS JSON (Greenhouse/Lever/Ashby/Workday) → Tier B Firecrawl+SerpApi → Tier C Apify → Tier D Crawl4AI+Playwright, with per-provider circuit breakers. Works with **zero API keys**; upgrades gracefully.
3. **Hybrid ranking (reciprocal rank fusion)** — three independent rankers fused via RRF, lexical + semantic, instead of a single black-box score.
4. **Knowledge graph extraction** (`app/services/knowledge_graph.py`) — auto-extracts achievements, skills, and timeline; surfaces skill gaps and links them to a career roadmap. Enterprise HR charges $50K–750K/yr for this; Tayari ships it self-hosted.
5. **One-Stop Jobseeker AI Command Suite** — integrated 8-tool career suite: **Typst ATS Exporter** (Rust single-page PDFs), **15-Min Company Radar Sentinel**, **WebSockets Real-Time Voice Interview Coach**, **Salary & Counter-Offer Negotiation Copilot**, **Skill Gap Radar & Free Learning Resource Engine**, **AI Interactive Portfolio Generator**, **Recruiter Cold Outreach Copilot**, and **Application Funnel Conversion Analytics**.

Plus: pipeline **guardrails** (`app/guardrails/` — keyword-stuffing detector, PII redaction, truthfulness gate, `PipelineGate`) that run **before** every application is submitted, and a **durable Celery/Redis autopilot** with run state queryable in Postgres and monitorable in Flower.

---

## 🏗 System Architecture

The stack is composed of specialized microservices communicating over HTTP and via message brokers.

### 1. API Gateway (Go)
*   **Directory**: `backend/go/`
*   **Role**: Primary entry point for client requests.
*   **Features**: 
    *   JWT validation and Supabase auth verification.
    *   Reverse proxies compute-heavy AI tasks (`/api/v1/ai/...`) to the Python Engine.
    *   Handles lightweight CRUD operations and funnel analytics.

### 2. AI Compute Engine (Python/FastAPI)
*   **Directory**: `backend/python/`
*   **Role**: The brain of the platform.
*   **Features**:
    *   **Resume Optimizer**: Ingests PDFs, extracts text via OCR/PyPDF, and runs semantic similarity matching against target Job Descriptions using LLMs (OpenRouter/Ollama).
    *   **Hermes Pipeline**: Agentic job scraper that pulls web data, structures it, and maps it against user skill vectors.
    *   **Browser Automation Agent** (`app/services/browser_automation/` & `integrations/browser_automation_agent/`): Autonomous user-based browser driver (`browser-use` + Playwright + Multi-Provider LLM Router) for natural-language web navigation and interactive job application submissions.
    *   **AutoPilot**: Orchestrates cover letter generation and automated email drafting.

### 3. Asynchronous Task Queue
*   **Broker**: Redis
*   **Worker**: Celery (Python)
*   **Monitor**: Celery Flower
*   **Workflow**: Long-running LLM inferences and batch scraping tasks are pushed to Redis by FastAPI, picked up by Celery workers, and executed asynchronously. Results are flushed to PostgreSQL.

### 4. Client Application (Frontend)
*   **Framework**: React, TypeScript, Vite.
*   **Styling & UI**: Tailwind CSS, shadcn/ui.
*   **State & Auth**: Supabase Auth context (supports both cloud and self-hosted instances).
*   **Routing**: React Router with protected route wrappers.

---

## ⚙️ Core Technical Flows

### Authentication & Self-Hosted Fallback
The frontend handles auth via `VITE_SUPABASE_URL`. When `VITE_USE_SELF_HOSTED=true`, requests are routed through a local Kong proxy (bundled in Docker) which mimics the Supabase GoTrue API. This allows 100% local development without a cloud dependency.

### The AutoPilot Run Context
The frontend `AutomationContext.tsx` holds a finite state machine mapping the user's progress through the ATS funnel (Resume -> Tailoring -> Review). State is persisted locally to `localStorage` to survive page reloads and avoid redundant LLM calls.

---

## 🐳 Docker Orchestration

The platform utilizes a unified `docker-compose.yml` to spin up 6 interdependent services.

```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.bash
docker compose up --build -d
```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.

### Network Topology (Internal DNS)
*   `frontend:4173` -> Exposed to host at `:8083` (or `:8090` via Caddy proxy)
*   `go-backend:8080` -> Exposed to host at `:8085`
*   `python-ai:8000` -> Exposed to host at `:8002`
*   `redis:6379` -> Internal only
*   `postgres:5432` -> Internal only
*   `celery-worker` -> Internal only
*   `celery-flower:5555` -> Exposed to host at `:5555`

## 📦 Deployment

### Development profile
Run the stack with hot‑reloading ports and dev‑only configuration:

```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.bash
docker compose --profile dev up -d
```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.

### Production profile
Run the stack using the production ports (standard HTTP ports) and any production‑grade settings:

```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.bash
docker compose --profile prod up -d
```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.

Both profiles respect the corresponding `.env.dev` and `.env.prod` files for environment variables (e.g., `JWT_SECRET`, `LLM_BASE_URL`).

### Helm deployment
A Helm chart is provided for Kubernetes deployments. To install or upgrade:

```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.bash
helm upgrade --install tariki ./helm/tayari \
  --set jwtSecret=${JWT_SECRET} \
  --set llmBaseUrl=${LLM_BASE_URL} \
  --set env=production
```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.

The chart includes a TLS secret reference (`tlsSecret: "tayari-tls"`) and an optional `jobApplicationAutomation` service block if this component is split into its own container.

## 🧪 Testing Protocol

*   **E2E (Playwright)**: Located in `e2e/`. Tests are configured to run headlessly against the Vite dev server. The suite validates complex multi‑step forms like the registration flow, enforcing strict password validation (12+ characters, mixed case, symbols) natively.
*   **Execution**: `npx playwright test e2e/features.spec.ts`

## 🔒 Feature Flagging

Features are strictly typed and managed in `src/config/features.ts`.
```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.typescript
export const features = {
  resumeOptimizer: [true, true], // [Development, Production]
  pricing: [true, true],
  careerOps: [true, false] // Coming soon to prod
}
```

**Kubernetes secret**: Before installing, create a secret containing the JWT secret:
```bash
kubectl create secret generic tayari-jwt --from-literal=jwtSecret=${JWT_SECRET}
```
The Helm chart will reference this secret via `jwtSecret` value.

**New features**: The deployment now includes the gamification achievements UI (accessible at `/achievements`) and the resume‑graph API (`/api/v1/resume/graph`). Ensure your front‑end routes and API clients are updated accordingly.
