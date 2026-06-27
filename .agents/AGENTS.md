# 🤖 Tayari Skill Boost - Agent Instructions

This file dictates specific constraints, rules, and architectural guidelines that all AI agents MUST follow when interacting with the `tayari-skill-boost` repository.

## 🏗 Architectural Rules

1.  **Strict Service Separation**:
    *   **Go (`backend/go/`)**: Must ONLY be used for routing, authentication, simple CRUD, and database queries. DO NOT implement complex LLM logic here.
    *   **Python (`backend/python/`)**: Must ALWAYS be used for AI inference, NLP, web scraping (Hermes), and async workers (Celery). 
2.  **API Communication**:
    *   The frontend must NEVER call the Python AI engine directly. All requests must go through the Go API Gateway (e.g., `/api/v1/ai/...`), which acts as a reverse proxy.
3.  **Local First / Self-Hosted Compatibility**:
    *   Always respect the `VITE_USE_SELF_HOSTED` flag in the frontend. 
    *   Never hardcode cloud Supabase URLs; always use the environment variables to ensure the self-hosted Docker mode continues to function perfectly.
4.  **Database Migrations**:
    *   PostgreSQL schema changes must be meticulously documented and ideally added to init scripts.

## 🎨 Frontend Coding Standards

1.  **Styling**: Use Tailwind CSS exclusively. Do not write raw CSS unless absolutely necessary for complex animations. Use `shadcn/ui` components for all standard UI elements (buttons, inputs, dialogs).
2.  **State Management**: Use React Context for global state (e.g., `AuthContext`, `AutomationContext`). Avoid pulling in heavy state managers like Redux.
3.  **Feature Flags**: If you are adding a new page or a major component, you MUST register it in `src/config/features.ts` and wrap its visibility using the existing feature flag logic.

## 🧪 Testing Constraints

1.  **E2E Testing**: Any change to the authentication flow, navigation, or pricing pages must be accompanied by an update to the Playwright suite (`e2e/features.spec.ts`).
2.  **Password Strictness**: The platform enforces a strict 12-character minimum password policy. If you write a test script or seed script, the password MUST conform to this standard or the test will silently fail.
3.  **Network Resolution**: When testing or pinging services via scripts, prefer `127.0.0.1` over `localhost` to avoid IPv6 resolution timeouts.

## 🚀 Docker & Deployment

1.  **Env Variables**: Ensure that new frontend environment variables (prefixed with `VITE_`) are properly documented in `.env.example` and are accounted for during the Docker build phase, as Vite statically replaces them.
2.  **Zero-Downtime Awareness**: Do not introduce blocking loops in the Go or Python services. Offload heavy processing to Celery workers.
