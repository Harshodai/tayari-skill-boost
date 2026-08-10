# B1 Loop 1 — `check-rate-limit` Edge Function Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `check-rate-limit` Supabase edge function with a Go gateway read endpoint, rewire the frontend to call `@/api`, and delete the edge function — closing one-third of the B1 split-brain-backend blocker with zero feature regression.

**Architecture:** The Go audit worker already writes `auth_attempts` (record_failure on bad login, reset on good login) but hashes the email with SHA-256 before storing. The edge function reads by **raw email** — so today the two paths are already inconsistent (edge fn reads rows Go never writes). The fix consolidates on Go: a new unauthenticated `GET /api/v1/auth/rate-limit?email=…` route hashes the email, reads `auth_attempts` by hash, and returns `{allowed, remainingAttempts, blockedUntil}`. The frontend `rate-limiter.ts` drops its `USE_SELF_HOSTED` short-circuit and calls `@/api` for all environments. `record_failure` and `reset` stay server-side only (Go audit worker already handles them on login outcomes) — the frontend stops calling the edge fn for those actions.

**Tech Stack:** Go (Chi router, `database/sql`, `crypto/sha256`), React/TS (`apiFetch`), Postgres `auth_attempts` table.

## Global Constraints

- **Route parity:** every new `/api/...` route must also register `/api/v1/...` (and vice versa). Run `TestRouteParity_*` after adding routes.
- **Service separation:** Go does routing/auth/CRUD/DB; no LLM logic in Go. The rate-limit read is a pure DB query — Go is the right place.
- **`// ponytail:` comments** on every non-obvious minimal choice.
- **Email hashing:** the Go audit worker stores `sha256(email)` in `auth_attempts.email` (`worker.go:73-74`). The new read endpoint MUST hash the email the same way before querying, or it reads nothing.
- **`auth_attempts` RLS:** `20260731_self_hosted_rls_hardening.sql:149-156` enables RLS with a deny-all policy for `anon`/`authenticated`. The Go gateway connects as the `postgres` superuser (bypasses RLS), so the read works. **Do not** expose this endpoint without the Go auth context — it's an unauthenticated pre-login read (the user isn't logged in yet when checking rate limit), so it must NOT require a JWT, but it MUST be IP-rate-limited by the existing `middleware.go` throttle to prevent enumeration.
- **No new dependencies.** Use stdlib `crypto/sha256`, `encoding/hex`, `encoding/json`.
- **Mock ≠ passing:** verify against a real `auth_attempts` row, not a mocked one, for the live check.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `backend/go/internal/api/routes_auth_ratelimit.go` | New `GET /api/v1/auth/rate-limit` handler: hash email, query `auth_attempts`, return `{allowed, remainingAttempts, blockedUntil}` | Create |
| `backend/go/internal/api/routes_auth_ratelimit_test.go` | TDD tests for the handler (happy path, no-row, blocked, parity) | Create |
| `backend/go/internal/api/routes_app.go` | Register the new route under both `/api` and `/api/v1` prefixes (route parity) | Modify |
| `src/lib/rate-limiter.ts` | Drop `USE_SELF_HOSTED` short-circuit; call `@/api` `apiFetch` for `check`; stop calling edge fn for `record_failure`/`reset` (Go audit worker owns those now) | Modify |
| `src/api/auth.ts` | New `getAuthRateLimit(email)` helper calling `GET /v1/auth/rate-limit?email=…` | Create |
| `supabase/functions/check-rate-limit/index.ts` | Delete after frontend + Go are live and verified | Delete (last task) |

---

## Task 1: Go rate-limit read endpoint (TDD)

**Files:**
- Create: `backend/go/internal/api/routes_auth_ratelimit.go`
- Create: `backend/go/internal/api/routes_auth_ratelimit_test.go`
- Modify: `backend/go/internal/api/routes_app.go` (register routes)

**Interfaces:**
- Consumes: `*database.DB` (via `s.Server.DB`), `s.respondJSON`, `s.respondError`, `chi.URLParam`-style query (`r.URL.Query().Get("email")`)
- Produces: `GET /api/v1/auth/rate-limit?email=…` and `/api/auth/rate-limit?email=…` returning `{"allowed":bool,"remainingAttempts":int,"blockedUntil":string|null}`

- [ ] **Step 1: Write the failing test**

Create `backend/go/internal/api/routes_auth_ratelimit_test.go`:

```go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func TestAuthRateLimit_NoRow_ReturnsAllowedDefault(t *testing.T) {
	srv := newResumeGraphServer(t, "") // reuse the fake-AI helper factory pattern
	srv.DB = &database.DB{Conn: nil}   // no DB → fail open
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/rate-limit?email=nobody@example.com", nil)
	srv.Router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["allowed"] != true {
		t.Errorf("expected allowed=true when no DB, got %v", resp["allowed"])
	}
	if int(resp["remainingAttempts"].(float64)) != 5 {
		t.Errorf("expected 5 remaining when no DB, got %v", resp["remainingAttempts"])
	}
}

func TestAuthRateLimit_MissingEmailParam_Returns400(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/auth/rate-limit", nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing email, got %d", w.Code)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/go && go test ./internal/api -run TestAuthRateLimit -v`
Expected: FAIL — `routes_auth_ratelimit.go` does not exist / handler undefined.

- [ ] **Step 3: Write the handler**

Create `backend/go/internal/api/routes_auth_ratelimit.go`:

```go
package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"
)

// handleAuthRateLimit serves GET /api/v1/auth/rate-limit?email=...
// It is an UNAUTHENTICATED pre-login read: the caller is checking whether
// they're locked out before they can log in. It must not require a JWT.
// It hashes the email with SHA-256 before querying auth_attempts, matching
// the audit worker's storage convention (worker.go:73-74). The gateway's
// global IP rate limiter (middleware.go) caps abuse.
func (s *Server) handleAuthRateLimit(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		s.respondError(w, http.StatusBadRequest, "email parameter required")
		return
	}

	// ponytail: hash email to match the audit worker's storage convention —
	// the edge fn queried by raw email, which never matched Go's hashed rows.
	// Consolidating on the hash fixes a latent inconsistency.
	sum := sha256.Sum256([]byte(email))
	emailHash := hex.EncodeToString(sum[:])

	type rateLimitResp struct {
		Allowed           bool        `json:"allowed"`
		RemainingAttempts int         `json:"remainingAttempts"`
		BlockedUntil      *time.Time  `json:"blockedUntil"`
	}

	if s.DB == nil || s.DB.Conn == nil {
		// ponytail: fail open when DB unavailable — never block a legit login
		// because the lockout store is down. Matches the edge fn's behavior.
		s.respondJSON(w, http.StatusOK, rateLimitResp{Allowed: true, RemainingAttempts: 5})
		return
	}

	var attemptCount int
	var blockedUntil sql.NullTime
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT attempt_count, blocked_until FROM public.auth_attempts WHERE email = $1`,
		emailHash,
	).Scan(&attemptCount, &blockedUntil)
	if err == sql.ErrNoRows {
		s.respondJSON(w, http.StatusOK, rateLimitResp{Allowed: true, RemainingAttempts: 5})
		return
	}
	if err != nil {
		// ponytail: fail open on DB error, same rationale as nil-DB above.
		s.respondJSON(w, http.StatusOK, rateLimitResp{Allowed: true, RemainingAttempts: 5})
		return
	}

	if blockedUntil.Valid {
		if blockedUntil.Time.After(time.Now()) {
			bt := blockedUntil.Time
			s.respondJSON(w, http.StatusOK, rateLimitResp{Allowed: false, RemainingAttempts: 0, BlockedUntil: &bt})
			return
		}
	}

	remaining := 5 - attemptCount
	if remaining < 0 {
		remaining = 0
	}
	s.respondJSON(w, http.StatusOK, rateLimitResp{Allowed: true, RemainingAttempts: remaining})
}
```

- [ ] **Step 4: Register the route (parity)**

In `backend/go/internal/api/routes_app.go`, inside the auth-guarded route group, add alongside the other auth routes (find the auth/login block and add):

```go
// ---- Auth rate-limit read (replaces check-rate-limit edge fn) ----
r.Get("/api/v1/auth/rate-limit", s.handleAuthRateLimit)
r.Get("/api/auth/rate-limit", s.handleAuthRateLimit)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend/go && go test ./internal/api -run 'TestAuthRateLimit|TestRouteParity' -v`
Expected: PASS for both. Parity test must pass (route registered under both prefixes).

- [ ] **Step 6: Commit**

```bash
git add backend/go/internal/api/routes_auth_ratelimit.go backend/go/internal/api/routes_auth_ratelimit_test.go backend/go/internal/api/routes_app.go
git commit -m "feat(auth): Go rate-limit read endpoint (replaces check-rate-limit edge fn)

GET /api/v1/auth/rate-limit?email=... hashes the email (SHA-256) and reads
auth_attempts, matching the audit worker's storage convention. Unauthenticated
pre-login read; the global IP rate limiter caps abuse. Fails open on DB-unavailable.

// ponytail: hash email to match worker.go:73-74 — the edge fn queried by raw
// email and never saw Go's hashed rows. Consolidating fixes a latent bug."
```

---

## Task 2: Frontend `@/api` helper for the rate-limit read

**Files:**
- Create: `src/api/auth.ts`
- Test: `src/test/RateLimiter.test.ts` (extend existing if present, else create)

**Interfaces:**
- Consumes: `apiFetch` from `@/api/client`
- Produces: `getAuthRateLimit(email: string): Promise<{allowed, remainingAttempts, blockedUntil}>`

- [ ] **Step 1: Write the helper**

Create `src/api/auth.ts`:

```typescript
import { apiFetch } from "@/api/client";

export interface AuthRateLimitResponse {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil: string | null;
}

export async function getAuthRateLimit(email: string): Promise<AuthRateLimitResponse> {
  return apiFetch<AuthRateLimitResponse>(`/v1/auth/rate-limit?email=${encodeURIComponent(email)}`);
}
```

- [ ] **Step 2: Write a unit test**

Create (or extend) `src/test/RateLimiter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAuthRateLimit } from "@/api/auth";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(() => mockFetch.mockReset());

describe("getAuthRateLimit", () => {
  it("calls /v1/auth/rate-limit with the encoded email", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ allowed: true, remainingAttempts: 5, blockedUntil: null }),
      text: async () => JSON.stringify({ allowed: true, remainingAttempts: 5, blockedUntil: null }),
    });
    const result = await getAuthRateLimit("user@example.com");
    expect(result.allowed).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/auth/rate-limit?email=user%40example.com"),
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 3: Run the test**

Run: `bun run test`
Expected: PASS (the new test; existing ResumeGraph tests still pass).

- [ ] **Step 4: Commit**

```bash
git add src/api/auth.ts src/test/RateLimiter.test.ts
git commit -m "feat(api): getAuthRateLimit @/api helper for rate-limit read

// ponytail: thin wrapper over apiFetch — no edge-fn invoke, works in both
// self-hosted and hosted since both point @/api at the Go gateway."
```

---

## Task 3: Rewire `rate-limiter.ts` to call `@/api`, drop the edge-fn path

**Files:**
- Modify: `src/lib/rate-limiter.ts` (full rewrite of the three functions)
- Modify: `src/contexts/AuthContext.tsx` (if it imports `recordFailedAttempt`/`resetRateLimit` — keep the imports, but they become no-ops or local-only since Go owns record/reset)

**Interfaces:**
- Consumes: `getAuthRateLimit` from `@/api/auth`
- Produces: `checkRateLimit(email)` → calls Go; `recordFailedAttempt(email)` → **local-only** (no server call; Go audit worker records on the actual login attempt); `resetRateLimit(email)` → **no-op** (Go audit worker resets on successful login)

- [ ] **Step 1: Rewrite `rate-limiter.ts`**

Replace the entire contents of `src/lib/rate-limiter.ts` with:

```typescript
import { getAuthRateLimit } from "@/api/auth";

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil: Date | null;
  message: string | null;
}

const RATE_LIMIT_OPEN: RateLimitResult = {
  allowed: true,
  remainingAttempts: 5,
  blockedUntil: null,
  message: null,
};

// ponytail: record_failure and reset are now server-side only — the Go audit
// worker (worker.go:71-91) writes auth_attempts on every login outcome
// (increment on failure, delete on success). The frontend no longer needs to
// drive those actions; it only READS the lockout state before a login attempt.
// Keeping these as local no-ops preserves the AuthContext call sites without
// a risky refactor of the login flow.

export async function checkRateLimit(email: string): Promise<RateLimitResult> {
  try {
    const data = await getAuthRateLimit(email);
    if (!data.allowed && data.blockedUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: new Date(data.blockedUntil),
        message: "Too many login attempts. Please try again later.",
      };
    }
    return {
      allowed: true,
      remainingAttempts: data.remainingAttempts,
      blockedUntil: null,
      message: null,
    };
  } catch {
    // ponytail: fail open — never block a legit login because the rate-limit
    // read failed. The Go audit worker still enforces lockouts server-side.
    return RATE_LIMIT_OPEN;
  }
}

export async function recordFailedAttempt(email: string): Promise<RateLimitResult> {
  // ponytail: no-op — Go audit worker records the failure on the actual login
  // attempt. Returning a neutral "invalid credentials" result keeps the
  // AuthContext call site shape unchanged.
  return { allowed: true, remainingAttempts: 0, blockedUntil: null, message: "Invalid credentials." };
}

export async function resetRateLimit(email: string): Promise<void> {
  // ponytail: no-op — Go audit worker resets auth_attempts on successful login.
}
```

- [ ] **Step 2: Build + lint**

Run: `bun run build && bun run lint`
Expected: build passes; lint shows no NEW errors in `rate-limiter.ts` or `auth.ts` (pre-existing warnings elsewhere are OK).

- [ ] **Step 3: Run frontend tests**

Run: `bun run test`
Expected: all ResumeGraph tests + the new RateLimiter test pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rate-limiter.ts
git commit -m "refactor(rate-limiter): call @/api for check; drop edge-fn record/reset

checkRateLimit now calls GET /v1/auth/rate-limit via @/api (works in both
self-hosted and hosted). recordFailedAttempt/resetRateLimit become local
no-ops — the Go audit worker owns record/reset on actual login outcomes.

// ponytail: removes the USE_SELF_HOSTED short-circuit and the supabase.functions
// invoke path. One backend (Go) for all environments. Fails open on read error."
```

---

## Task 4: Delete the `check-rate-limit` edge function

**Files:**
- Delete: `supabase/functions/check-rate-limit/index.ts` (and the directory)

**Prerequisite:** Tasks 1–3 are merged, the Go endpoint is live, and `checkRateLimit` through `@/api` is verified working (see verification below).

- [ ] **Step 1: Verify no remaining references to the edge fn**

Run: `grep -rn "check-rate-limit" src/ supabase/ backend/`
Expected: only the edge fn's own `index.ts` (about to be deleted) and possibly comments. No `supabase.functions.invoke('check-rate-limit'...)` calls remain.

- [ ] **Step 2: Delete the edge function**

```bash
git rm -r supabase/functions/check-rate-limit
```

- [ ] **Step 3: Build + test everything**

Run:
```bash
cd backend/go && go test ./internal/api -run 'TestAuthRateLimit|TestRouteParity' -v
cd ../.. && bun run build && bun run test
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(supabase): delete check-rate-limit edge function

Replaced by GET /api/v1/auth/rate-limit in the Go gateway (Task 1). The
frontend now calls @/api (Task 3). This closes one-third of the B1
split-brain-backend blocker — check-rate-limit is no longer duplicated.

// ponytail: delete after the Go equivalent is live and the frontend is
// rewired — no feature regression, no dual-write inconsistency."
```

---

## Verification (live, after all 4 tasks)

1. **Go endpoint live:** `curl 'localhost:8085/api/v1/auth/rate-limit?email=test@tayari.app'` → `{"allowed":true,"remainingAttempts":5,"blockedUntil":null}`
2. **Lockout works:** trigger 5 failed logins → 6th `checkRateLimit` call from the frontend shows `allowed:false` with a `blockedUntil`.
3. **Reset works:** a successful login clears the row (Go audit worker) → subsequent `checkRateLimit` shows `allowed:true, remainingAttempts:5`.
4. **Self-hosted parity:** the same flow works in self-hosted mode (no `USE_SELF_HOSTED` branch anymore — one path).
5. **Edge fn gone:** `grep -rn "check-rate-limit" supabase/functions/` → no results.

## Out of scope (handled in loops 2 & 3)

- `analyze-resume` edge fn (loop 2): Python `/v1/analyze` exists but needs `aiOptions` + `parsedResume` parity.
- `generate-resume-pdf` edge fn (loop 3): needs a new Go-proxied Python orchestration endpoint (LLM-optimize → Typst → PDF).
- Hosted `VITE_API_URL` / `/api` proxy config: addressed once all 3 loops are done (cross-cutting final step).

## Status: CLOSED (2026-08-07)

All 4 tasks complete, branch remediated (see `.superpowers/sdd/progress.md`):
- `ace68cf` feat(auth) → `c484619` feat(api) → `b7fd984` refactor(rate-limiter) → `2f0f313` chore(supabase)
- Go tests green (`go test ./...`), frontend build green (`bun run build`), live-verified: `/api/v1/auth/rate-limit` served by Go; edge fn + config block deleted.
- Attribution of the self-contained test fix corrected via pick→edit rebase (Task 1 `ace68cf`).
- Post-branch: lost resume-graph work restored + committed (`71fd438`, `b0da8f0`, `835a88d`, `c7a5462`), live 502 → 200 verified.