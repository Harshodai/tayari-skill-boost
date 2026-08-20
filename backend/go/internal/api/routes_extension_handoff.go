package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"

	"tayari-backend/internal/auth"
)

const extensionHandoffTTL = 2 * time.Minute

func (s *Server) routesExtensionHandoff(r chi.Router) {
	r.Post("/api/v1/auth/extension/handoff/exchange", s.handleExtensionHandoffExchange)
	r.Post("/api/auth/extension/handoff/exchange", s.handleExtensionHandoffExchange)
}

func (s *Server) routesProtectedExtensionHandoff(r chi.Router) {
	r.Post("/api/v1/auth/extension/handoff/request", s.handleExtensionHandoffRequest)
	r.Post("/api/auth/extension/handoff/request", s.handleExtensionHandoffRequest)
}

func (s *Server) handleExtensionHandoffRequest(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Authentication required.")
		return
	}
	code, err := randomExtensionHandoffCode()
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Could not create extension handoff.")
		return
	}
	expiresAt := time.Now().UTC().Add(extensionHandoffTTL)
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "Extension handoff storage is unavailable.")
		return
	}
	_, err = s.DB.Conn.ExecContext(r.Context(), `
		INSERT INTO public.extension_session_handoff_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, user.ID, extensionHandoffHash(code), expiresAt)
	if err != nil {
		s.respondError(w, http.StatusServiceUnavailable, "Could not create extension handoff.")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"code":       code,
		"expires_at": expiresAt,
	})
}

func (s *Server) handleExtensionHandoffExchange(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Code string `json:"code"`
	}
	if err := DecodeAndValidate(r, &request); err != nil || len(strings.TrimSpace(request.Code)) < 32 || len(request.Code) > 128 {
		s.respondError(w, http.StatusBadRequest, "Invalid extension handoff code.")
		return
	}
	if s.DB == nil || s.DB.Conn == nil || s.Config == nil || strings.TrimSpace(s.Config.JWTSecret) == "" {
		s.respondError(w, http.StatusServiceUnavailable, "Extension handoff is unavailable.")
		return
	}

	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusServiceUnavailable, "Extension handoff is unavailable.")
		return
	}
	defer tx.Rollback()

	var tokenID int64
	var userID string
	var email string
	var role string
	err = tx.QueryRowContext(r.Context(), `
		SELECT handoff.id, handoff.user_id, COALESCE(users.email, ''), COALESCE(users.role, 'authenticated')
		FROM public.extension_session_handoff_tokens AS handoff
		JOIN auth.users AS users ON users.id = handoff.user_id
		WHERE handoff.token_hash = $1
		  AND handoff.used_at IS NULL
		  AND handoff.expires_at > NOW()
		FOR UPDATE OF handoff
	`, extensionHandoffHash(strings.TrimSpace(request.Code))).Scan(&tokenID, &userID, &email, &role)
	if err != nil {
		s.respondError(w, http.StatusUnauthorized, "Invalid or expired extension handoff.")
		return
	}
	if _, err = tx.ExecContext(r.Context(), `UPDATE public.extension_session_handoff_tokens SET used_at = NOW() WHERE id = $1`, tokenID); err != nil {
		s.respondError(w, http.StatusServiceUnavailable, "Could not consume extension handoff.")
		return
	}
	if err = tx.Commit(); err != nil {
		s.respondError(w, http.StatusServiceUnavailable, "Could not consume extension handoff.")
		return
	}

	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   userID,
		"aud":   "authenticated",
		"email": email,
		"role":  role,
		"exp":   expiresAt.Unix(),
		"iat":   time.Now().UTC().Unix(),
		"iss":   "tayari-extension-handoff",
	})
	accessToken, err := token.SignedString([]byte(s.Config.JWTSecret))
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Could not issue extension session.")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": "",
		"expires_in":    int(time.Until(expiresAt).Seconds()),
		"token_type":    "bearer",
		"user": map[string]string{
			"id":    userID,
			"email": email,
		},
	})
}

func randomExtensionHandoffCode() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func extensionHandoffHash(code string) string {
	hash := sha256.Sum256([]byte(code))
	return hex.EncodeToString(hash[:])
}
