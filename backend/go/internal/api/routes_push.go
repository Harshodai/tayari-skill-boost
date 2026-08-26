package api

import (
	"log"
	"net/http"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// routesPush wires the push-notification endpoints. Both handlers read the
// caller's identity from context, so this must run behind authMiddleware —
// it never did before this fix, so every request 401'd unconditionally and
// push registration/sending was dead for every user.
func (s *Server) routesPush(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		// Protected push routes
		r.Post("/api/v1/push/register", s.handlePushRegister)
		r.Post("/api/v1/push/send", s.handlePushSend)
	})
}

type PushRegisterRequest struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func (s *Server) handlePushRegister(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req PushRegisterRequest
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Endpoint == "" || req.Keys.P256dh == "" || req.Keys.Auth == "" {
		s.respondError(w, http.StatusBadRequest, "endpoint, p256dh, and auth keys are required")
		return
	}

	query := `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (endpoint) 
		DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_id = EXCLUDED.user_id
	`
	_, err := s.DB.Conn.ExecContext(r.Context(), query, user.ID, req.Endpoint, req.Keys.P256dh, req.Keys.Auth)
	if err != nil {
		log.Printf("handlePushRegister: failed to save subscription: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to register push subscription")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]string{"status": "registered"})
}

type PushSendRequest struct {
	UserID string `json:"user_id"`
	Title  string `json:"title"`
	Body   string `json:"body"`
}

func (s *Server) handlePushSend(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req PushSendRequest
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	targetUserID, err := uuid.Parse(req.UserID)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid user_id format")
		return
	}

	// Fetch active subscriptions
	rows, err := s.DB.Conn.QueryContext(r.Context(),
		"SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1", targetUserID)
	if err != nil {
		log.Printf("handlePushSend: query error: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Database query error")
		return
	}
	defer rows.Close()

	type sub struct {
		Endpoint string
		P256dh   string
		Auth     string
	}
	var subs []sub
	for rows.Next() {
		var s sub
		if err := rows.Scan(&s.Endpoint, &s.P256dh, &s.Auth); err == nil {
			subs = append(subs, s)
		}
	}

	// There is no Web Push transport wired up here: no VAPID keys, no signing,
	// and no HTTP POST to the subscription endpoints (nothing in go.mod
	// provides it). This handler therefore cannot deliver anything, and must
	// not answer "sent" — callers surface that to a user as a delivered alert.
	// Fail closed with the same shape the AI routes use when unconfigured.
	log.Printf("[PUSH-SERVER] Push requested for user %s (%d subscriptions) but Web Push delivery is not configured; nothing was sent.",
		targetUserID, len(subs))

	s.respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
		"error":                 "push_delivery_unconfigured",
		"message":               "Web Push delivery is not configured on this server, so no notification was sent.",
		"matched_subscriptions": len(subs),
	})
}
