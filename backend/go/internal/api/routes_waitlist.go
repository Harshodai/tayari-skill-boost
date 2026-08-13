package api

import (
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"

	"github.com/go-chi/chi/v5"
)

const maxWaitlistRequestBytes = 8 * 1024

var allowedWaitlistTiers = map[string]struct{}{
	"institutions": {},
}

// RegisterWaitlistRoutes records commercial interest without creating a user
// account or exposing whether an address has previously registered.
func (s *Server) RegisterWaitlistRoutes(r chi.Router) {
	r.With(s.loginRateLimiter.Middleware).Post("/api/v1/waitlist/join", s.handleWaitlistJoin)
	r.With(s.loginRateLimiter.Middleware).Post("/api/waitlist/join", s.handleWaitlistJoin)
}

func validWaitlistEmail(value string) bool {
	if len(value) == 0 || len(value) > 254 {
		return false
	}
	parsed, err := mail.ParseAddress(value)
	return err == nil && parsed.Address == value && strings.Count(value, "@") == 1
}

func (s *Server) handleWaitlistJoin(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxWaitlistRequestBytes)
	defer r.Body.Close()

	var req struct {
		Email string `json:"email"`
		Tier  string `json:"tier"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "email and tier are required")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	tier := strings.ToLower(strings.TrimSpace(req.Tier))
	if !validWaitlistEmail(email) {
		s.respondError(w, http.StatusBadRequest, "a valid email address is required")
		return
	}
	if _, allowed := allowedWaitlistTiers[tier]; !allowed {
		s.respondError(w, http.StatusBadRequest, "unsupported interest tier")
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "lead capture is temporarily unavailable")
		return
	}

	_, err := s.DB.Conn.Exec(`
        INSERT INTO public.waitlist_leads (email, tier, source)
        VALUES ($1, $2, 'pricing')
        ON CONFLICT (email, tier) DO UPDATE
        SET updated_at = NOW()
    `, email, tier)
	if err != nil {
		s.respondError(w, http.StatusServiceUnavailable, "lead capture is temporarily unavailable")
		return
	}

	// Return the same accepted response for new and existing leads to avoid
	// address enumeration and keep the client contract idempotent.
	s.respondJSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}
