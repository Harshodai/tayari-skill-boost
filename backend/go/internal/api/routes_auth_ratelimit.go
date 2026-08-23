package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"
)

// handleAuthRateLimit serves POST /api/v1/auth/rate-limit with the email in a
// JSON body (never in the URL, so the value cannot leak through query strings
// or logs). It is an UNAUTHENTICATED pre-login read: the caller is checking
// whether they're locked out before they can log in. It must not require a
// JWT. It hashes the email with SHA-256 before querying auth_attempts,
// matching the audit worker's storage convention (worker.go:73-74). The
// gateway's global IP rate limiter (middleware.go) caps abuse.
func (s *Server) handleAuthRateLimit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		s.respondError(w, http.StatusBadRequest, "email parameter required")
		return
	}
	email := req.Email

	// ponytail: hash email to match the audit worker's storage convention —
	// the edge fn queried by raw email, which never matched Go's hashed rows.
	// Consolidating on the hash fixes a latent inconsistency.
	sum := sha256.Sum256([]byte(email))
	emailHash := hex.EncodeToString(sum[:])

	type rateLimitResp struct {
		Allowed           bool       `json:"allowed"`
		RemainingAttempts int        `json:"remainingAttempts"`
		BlockedUntil      *time.Time `json:"blockedUntil"`
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
