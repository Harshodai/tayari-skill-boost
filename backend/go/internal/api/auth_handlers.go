package api

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"
)

// Auth Handlers
// -------------------------------------------------------------------

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		log.Printf("handleRegister: failed to decode request body: %v", err)
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(req.Email)

	if req.Email == "" {
		s.respondError(w, http.StatusBadRequest, "Email is required")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid email format")
		return
	}

	if req.Password == "" {
		s.respondError(w, http.StatusBadRequest, "Password is required")
		return
	}
	if len(req.Password) < 8 {
		s.respondError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	user, err := s.Auth.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		hash := sha256.Sum256([]byte(req.Email))
		emailHash := hex.EncodeToString(hash[:16])
		log.Printf("handleRegister: registration failed for hash:%s: %v", emailHash, err)
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
			s.respondError(w, http.StatusConflict, "User already exists")
		} else {
			s.respondError(w, http.StatusInternalServerError, "Registration failed")
		}
		return
	}

	s.respondJSON(w, http.StatusOK, user)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	token, err := s.Auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		s.respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]string{"token": token})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	s.respondJSON(w, http.StatusOK, user)
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			s.respondError(w, http.StatusUnauthorized, "Authorization header required")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			s.respondError(w, http.StatusUnauthorized, "Invalid authorization header format")
			return
		}
		tokenStr := parts[1]
		if tokenStr == "" {
			s.respondError(w, http.StatusUnauthorized, "Token is required")
			return
		}

		user, err := s.Auth.VerifyToken(tokenStr)
		if err != nil {
			s.respondError(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		ctx := auth.WithUserContext(r.Context(), user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// -------------------------------------------------------------------
