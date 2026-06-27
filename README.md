# 🚀 Tayari Skill Boost

Tayari Skill Boost is a highly scalable, event-driven career operations platform designed to orchestrate AI-based workflows. It leverages a microservices architecture to process unstructured resume data, execute asynchronous job-scraping pipelines, and simulate Applicant Tracking System (ATS) parsing.

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

```bash
docker compose up --build -d
```

### Network Topology (Internal DNS)
*   `frontend:4173` -> Exposed to host at `:8083` (or `:8090` via Caddy proxy)
*   `go-backend:8080` -> Exposed to host at `:8085`
*   `python-ai:8000` -> Exposed to host at `:8002`
*   `redis:6379` -> Internal only
*   `postgres:5432` -> Internal only
*   `celery-worker` -> Internal only
*   `celery-flower:5555` -> Exposed to host at `:5555`

## 🧪 Testing Protocol

*   **E2E (Playwright)**: Located in `e2e/`. Tests are configured to run headlessly against the Vite dev server. The suite validates complex multi-step forms like the registration flow, enforcing strict password validation (12+ characters, mixed case, symbols) natively.
*   **Execution**: `npx playwright test e2e/features.spec.ts`

## 🔒 Feature Flagging

Features are strictly typed and managed in `src/config/features.ts`.
```typescript
export const features = {
  resumeOptimizer: [true, true], // [Development, Production]
  pricing: [true, true],
  careerOps: [true, false] // Coming soon to prod
}
```
