package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"tayari-backend/internal/models"
)

const apiKeyPrefix = "tay_"

type apiKeyContextKey struct{}

func generateAPIKey() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		return "", "", e
	}
	raw = apiKeyPrefix + hex.EncodeToString(b)
	h := sha256.Sum256([]byte(raw))
	return raw, hex.EncodeToString(h[:]), nil
}

func (s *Server) routesAPIKeys(r chi.Router) {
	r.Post("/api/v1/api-keys", s.handleCreateAPIKey)
	r.Get("/api/v1/api-keys", s.handleListAPIKeys)
	r.Delete("/api/v1/api-keys/{id}", s.handleRevokeAPIKey)
	r.Get("/api/v1/api-keys/usage/{id}", s.handleAPIKeyUsage)

	r.Post("/api/api-keys", s.handleCreateAPIKey)
	r.Get("/api/api-keys", s.handleListAPIKeys)
	r.Delete("/api/api-keys/{id}", s.handleRevokeAPIKey)
	r.Get("/api/api-keys/usage/{id}", s.handleAPIKeyUsage)
}

func (s *Server) routesPublic(r chi.Router) {
	r.Post("/api/v1/public/optimize", s.apiKeyMiddleware(s.handlePublicOptimize))
	r.Post("/api/public/optimize", s.apiKeyMiddleware(s.handlePublicOptimize))
}

func (s *Server) handleCreateAPIKey(w http.ResponseWriter, r *http.Request) {
	u, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || u == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req struct {
		Name      string `json:"name"`
		RateLimit int    `json:"rate_limit,omitempty"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		s.respondError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if req.RateLimit <= 0 {
		req.RateLimit = 60
	}

	raw, hash, err := generateAPIKey()
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to generate key")
		return
	}

	prefix := raw[:len(apiKeyPrefix)+8]

	var id int64
	err = s.DB.Conn.QueryRowContext(r.Context(),
		`INSERT INTO api_keys (user_id, name, key_prefix, key_hash, rate_limit)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		u.ID, req.Name, prefix, hash, req.RateLimit).Scan(&id)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to create API key")
		return
	}

	s.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         id,
		"name":       req.Name,
		"key_prefix": prefix,
		"raw_key":    raw,
		"rate_limit": req.RateLimit,
	})
}

func (s *Server) handleListAPIKeys(w http.ResponseWriter, r *http.Request) {
	u, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || u == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, user_id, name, key_prefix, is_active, rate_limit, created_at, last_used_at
		 FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC`, u.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to list API keys")
		return
	}
	defer rows.Close()

	type keyRow struct {
		ID         int64      `json:"id"`
		UserID     string     `json:"user_id"`
		Name       string     `json:"name"`
		KeyPrefix  string     `json:"key_prefix"`
		IsActive   bool       `json:"is_active"`
		RateLimit  int        `json:"rate_limit"`
		CreatedAt  time.Time  `json:"created_at"`
		LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	}

	keys := []keyRow{}
	for rows.Next() {
		var k keyRow
		var lu pgtype.Timestamptz
		if err := rows.Scan(&k.ID, &k.UserID, &k.Name, &k.KeyPrefix, &k.IsActive, &k.RateLimit, &k.CreatedAt, &lu); err != nil {
			continue
		}
		if lu.Valid {
			k.LastUsedAt = &lu.Time
		}
		keys = append(keys, k)
	}
	s.respondJSON(w, http.StatusOK, keys)
}

func (s *Server) handleRevokeAPIKey(w http.ResponseWriter, r *http.Request) {
	u, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || u == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	id := chi.URLParam(r, "id")
	res, err := s.DB.Conn.ExecContext(r.Context(),
		`UPDATE api_keys SET is_active=false WHERE id=$1 AND user_id=$2`, id, u.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to revoke API key")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		s.respondError(w, http.StatusNotFound, "API key not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

func (s *Server) handleAPIKeyUsage(w http.ResponseWriter, r *http.Request) {
	u, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || u == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	id := chi.URLParam(r, "id")

	var exists int
	if err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT 1 FROM api_keys WHERE id=$1 AND user_id=$2`, id, u.ID).Scan(&exists); err != nil {
		s.respondError(w, http.StatusNotFound, "API key not found")
		return
	}

	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT endpoint, status_code, response_ms, created_at
		 FROM api_usage WHERE api_key_id=$1 ORDER BY created_at DESC LIMIT 100`, id)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch usage")
		return
	}
	defer rows.Close()

	type usageRow struct {
		Endpoint   string    `json:"endpoint"`
		StatusCode int       `json:"status_code"`
		ResponseMs int       `json:"response_ms,omitempty"`
		CreatedAt  time.Time `json:"created_at"`
	}

	usage := []usageRow{}
	for rows.Next() {
		var u usageRow
		rows.Scan(&u.Endpoint, &u.StatusCode, &u.ResponseMs, &u.CreatedAt)
		usage = append(usage, u)
	}
	s.respondJSON(w, http.StatusOK, usage)
}

func (s *Server) apiKeyMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			key = r.URL.Query().Get("api_key")
		}
		if key == "" {
			s.respondError(w, http.StatusUnauthorized, "Missing X-API-Key header or api_key query param")
			return
		}

		h := sha256.Sum256([]byte(key))
		hashHex := hex.EncodeToString(h[:])

		var m models.ApiKey
		var lu pgtype.Timestamptz
		err := s.DB.Conn.QueryRowContext(r.Context(),
			`SELECT id, user_id, name, key_prefix, is_active, rate_limit, created_at, last_used_at
			 FROM api_keys WHERE key_hash=$1`, hashHex).Scan(
			&m.ID, &m.UserID, &m.Name, &m.KeyPrefix, &m.IsActive, &m.RateLimit, &m.CreatedAt, &lu)
		if err != nil {
			s.respondError(w, http.StatusUnauthorized, "Invalid API key")
			return
		}
		if !m.IsActive {
			s.respondError(w, http.StatusForbidden, "API key is revoked")
			return
		}

		ctx := context.WithValue(r.Context(), apiKeyContextKey{}, &m)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func (s *Server) handlePublicOptimize(w http.ResponseWriter, r *http.Request) {
	ak, _ := r.Context().Value(apiKeyContextKey{}).(*models.ApiKey)
	if ak == nil {
		s.respondError(w, http.StatusUnauthorized, "API key context missing")
		return
	}

	var req struct {
		ResumeText     string `json:"resume_text"`
		JobDescription string `json:"job_description"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ResumeText == "" {
		s.respondError(w, http.StatusBadRequest, "resume_text is required")
		return
	}

	start := time.Now()
	payload := map[string]interface{}{
		"resume_text":     req.ResumeText,
		"job_description": req.JobDescription,
		"original_text":   req.ResumeText,
	}
	result, err := s.AI.PostJSON("/api/v1/optimizer/optimize", payload)
	elapsed := time.Since(start).Milliseconds()

	statusCode := http.StatusOK
	if err != nil {
		statusCode = http.StatusBadGateway
		s.respondError(w, statusCode, fmt.Sprintf("AI service error: %v", err))
	}

	s.DB.Conn.ExecContext(r.Context(),
		`INSERT INTO api_usage (api_key_id, endpoint, status_code, ip_address, response_ms)
		 VALUES ($1, $2, $3, $4, $5)`,
		ak.ID, "/api/v1/public/optimize", statusCode, r.RemoteAddr, elapsed)

	s.DB.Conn.ExecContext(r.Context(),
		`UPDATE api_keys SET last_used_at=now() WHERE id=$1`, ak.ID)

	if err == nil {
		s.respondJSON(w, http.StatusOK, result)
	}
}
