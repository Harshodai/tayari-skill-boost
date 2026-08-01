package api

import (
	"bufio"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// routesSecurity mounts security-utility endpoints that need no DB and no
// user auth (they run on the signup form before an account exists). Rate
// limited like register/login — it's signup-adjacent and a remote HIBP
// proxy is exactly the kind of endpoint abuse would target.
func (s *Server) routesSecurity(r chi.Router) {
	r.With(s.loginRateLimiter.Middleware).Post("/api/v1/security/check-breached-password", s.handleCheckBreachedPassword)
	r.With(s.loginRateLimiter.Middleware).Post("/api/security/check-breached-password", s.handleCheckBreachedPassword)
}

// pwnedPasswordsClient is a short-timeout client dedicated to the HIBP
// range API — this must never block the signup form for long.
var pwnedPasswordsClient = &http.Client{Timeout: 5 * time.Second}

// handleCheckBreachedPassword implements the k-Anonymity password-breach
// check the frontend previously called as a Supabase Edge Function
// (supabase.functions.invoke("check-breached-password") in
// src/pages/Auth.tsx) — a function that only ever existed as a frontend
// call with no implementation anywhere in this repo, Cloud or self-hosted.
// self-hosted's supabase-local/ ships no Edge Functions runtime at all (see
// CLAUDE.md), so that call 404'd/DNS-failed at Kong for every self-hosted
// deployment; it happened to fail open (Auth.tsx just skips the breach
// warning), which is why signup itself was never blocked by it.
//
// This replaces the call with a real one: the client hashes the password
// (SHA-1) and sends only the 5-char hash prefix, this handler queries
// https://api.pwnedpasswords.com/range/{prefix} (the k-Anonymity model —
// HIBP never sees the full hash or the password), and the full-length
// suffixes returned are matched against the client's suffix here, server
// side, so the count also never leaks which password matched to HIBP.
func (s *Server) handleCheckBreachedPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HashPrefix string `json:"hashPrefix" validate:"required,len=5,hexadecimal"`
		HashSuffix string `json:"hashSuffix" validate:"required,len=35,hexadecimal"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "hashPrefix must be 5 hex chars and hashSuffix must be 35 hex chars (SHA-1 split for k-Anonymity)")
		return
	}
	prefix := strings.ToUpper(req.HashPrefix)
	suffix := strings.ToUpper(req.HashSuffix)

	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://api.pwnedpasswords.com/range/"+prefix, nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to build breach-check request")
		return
	}
	// Identify ourselves per HIBP's API etiquette guidance; no key required
	// for the range endpoint.
	httpReq.Header.Set("User-Agent", "tayari-skill-boost")
	httpReq.Header.Set("Add-Padding", "true")

	resp, err := pwnedPasswordsClient.Do(httpReq)
	if err != nil {
		// Fail open: never block signup because a third-party breach
		// directory is unreachable. Matches the frontend's own existing
		// fail-open handling of a failed check.
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"breached": false,
			"error":    "breach_check_unavailable",
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"breached": false,
			"error":    "breach_check_unavailable",
		})
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		gotSuffix, countStr, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		if gotSuffix != suffix {
			continue
		}
		count, err := strconv.Atoi(strings.TrimSpace(countStr))
		if err != nil {
			continue
		}
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"breached": true,
			"count":    count,
		})
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"breached": false,
		"count":    0,
	})
}
