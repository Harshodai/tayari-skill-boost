# 📚 Lessons Learned & Code Review Guidelines

This document tracks technical learnings, user feedback, code review guidelines, and architectural rules to continuously improve code quality across the `tayari-skill-boost` codebase.

---

## 🛑 Production Readiness & Code Quality Rules

### 1. No Static Hardcoded Fallbacks or Payloads
- **Rule**: NEVER hardcode static dummy text (e.g., `'Senior Software Engineer with 6 years experience...'`, `'TechCorp Innovations'`, `'https://boards.greenhouse.io/...'`) inside React components or API payloads.
- **Rationale**: Hardcoded strings make components unviable for production and obscure integration bugs.
- **Action**: Always fetch candidate details dynamically from `AuthContext` (`user`) and `getProfile()` (`/v1/profile`). Provide clean, empty initial state values with interactive `<Input>` and `<Textarea>` controls.

### 2. Mandatory Usage of Central `apiFetch`
- **Rule**: NEVER use raw `fetch('/api/v1/...')` calls inside frontend components.
- **Rationale**: Direct `fetch` ignores environment configuration (`VITE_API_URL`, `VITE_USE_SELF_HOSTED`), omits `Authorization: Bearer <token>` headers, and bypasses global `401 Unauthorized` token clearance / event dispatching.
- **Action**: Always import and use `apiFetch<T>('/v1/...')` from `@/api`.

### 3. Explicit Error Banners & User Feedback
- **Rule**: Non-2xx API errors must never be swallowed silently or logged only to `console.error`.
- **Action**: Render visible, styled error banners (e.g. using `AlertCircle`) in the UI whenever an operation fails.

### 4. Concurrency & Async Lock Hygiene
- **Rule**: Avoid binding `asyncio.Lock()` instances at class declaration or module import time in Python services.
- **Rationale**: Top-level locks bind to a single event loop and raise `RuntimeError: Lock is bound to a different event loop` when invoked across concurrent pytest runs or worker loops.
- **Action**: Use lazy per-event-loop lock getters (`_get_repl_lock()`).

### 5. Transparent & Ethical AI Output Generation
- **Rule**: Do not inject hidden or stealth payload text (such as white text or hidden HTML comments) into candidate resumes or application packages.
- **Action**: Provide clear, transparent skill vector recommendations and ATS keyword additions.

---

## 🔄 Iterative Review Process
Whenever a code review finding or architectural flaw is identified during pair programming:
1. Fix the underlying issue completely without patching symptoms.
2. Verify with automated test suites (`pytest`, `npx tsc`, `npm run build`).
3. Record the guideline in this `lessons.md` file so future agent executions do not repeat the mistake.
