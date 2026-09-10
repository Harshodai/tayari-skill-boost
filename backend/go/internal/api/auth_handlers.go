package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/mail"
	"strings"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Auth Handlers
// -------------------------------------------------------------------

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		slog.Error("handleRegister: failed to decode request body", "error", err)
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
	if err := auth.ValidatePassword(req.Password); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	user, err := s.Auth.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		hash := sha256.Sum256([]byte(req.Email))
		emailHash := hex.EncodeToString(hash[:16])
		slog.Error("handleRegister: registration failed for hash", "value", emailHash, "error", err)
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

// handleChangePassword lets an authenticated self-hosted user change their
// password after re-proving the current one. This is the Go-gateway
// counterpart the frontend now calls in self-hosted mode: SecuritySettings
// previously called supabase.auth.signInWithPassword/updateUser
// unconditionally, which always fails with "Auth session missing!" in
// self-hosted mode because these users have no Supabase Auth session at all
// (the Go gateway issues its own JWT; Supabase Auth is never involved).
// PATCH /api/v1/account/password | /api/account/password
func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		s.respondError(w, http.StatusBadRequest, "Current and new password are required")
		return
	}
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "Database unavailable")
		return
	}

	var currentHash string
	if err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT encrypted_password FROM auth.users WHERE id = $1`, user.ID).Scan(&currentHash); err != nil {
		slog.Error("handleChangePassword: lookup failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to change password")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)); err != nil {
		// 400, not 401: client.ts's checkResponse() treats any 401 from the Go
		// gateway in self-hosted mode as "the session itself is invalid" and
		// force-signs the user out (see handleUnauthorized's comment) -- a
		// wrong *current* password is a form validation error, not an
		// expired/invalid session, and must not log the user out.
		s.respondError(w, http.StatusBadRequest, "Current password is incorrect")
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("handleChangePassword: bcrypt error", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to change password")
		return
	}
	if _, err := s.DB.Conn.ExecContext(r.Context(),
		`UPDATE auth.users SET encrypted_password=$1, updated_at=NOW() WHERE id=$2`,
		string(newHash), user.ID); err != nil {
		slog.Error("handleChangePassword: update failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to change password")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "Password changed successfully."})
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

		parts := strings.Fields(authHeader)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || len(parts[1]) > 8192 {
			s.respondError(w, http.StatusUnauthorized, "Invalid authorization header format")
			return
		}
		tokenStr := parts[1]
		if tokenStr == "" {
			s.respondError(w, http.StatusUnauthorized, "Token is required")
			return
		}

		var user *models.User
		var identity *auth.Identity
		var err error
		if verifier, ok := s.Auth.(auth.IdentityVerifier); ok {
			identity, err = verifier.VerifyIdentity(tokenStr)
			if identity != nil {
				user = identity.User
			}
		} else {
			user, err = s.Auth.VerifyToken(tokenStr)
			if user != nil {
				identity = &auth.Identity{UserID: user.ID, Email: user.Email, Method: auth.AuthMethodLegacy, User: user}
			}
		}
		if err != nil || user == nil {
			s.respondError(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		ctx := auth.WithUserContext(r.Context(), user)
		if identity != nil {
			ctx = auth.WithIdentityContext(ctx, identity)
		}
		var tenantID uuid.UUID
		if tenant, ok := ctx.Value(contextKeyTenant).(*models.Tenant); ok && tenant != nil {
			tenantID = tenant.ID
		}
		// See requestIdentityBox's doc comment: this is how the outer
		// request-logging middleware learns who the authenticated user is,
		// since it can't see the derived request object we're about to
		// create below.
		if box, ok := ctx.Value(contextKeyRequestIdentity).(*requestIdentityBox); ok && box != nil {
			box.userID = user.ID.String()
			if tenantID != uuid.Nil {
				box.tenantID = tenantID.String()
			}
		}
		requestID := requestTraceID(r)
		ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{
			Subject:   user.ID,
			TenantID:  tenantID,
			Roles:     append([]string(nil), identity.Roles...),
			RequestID: requestID,
			Epoch:     time.Now().Unix(),
		})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// -------------------------------------------------------------------

func (s *Server) handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		s.respondError(w, http.StatusBadRequest, "Verification token is required")
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "Database connection error")
		return
	}

	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	var userID uuid.UUID
	var dbEmail string
	var expiresAt time.Time
	var used bool

	err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT user_id, email, expires_at, used FROM email_verification_tokens WHERE token_hash = $1`,
		tokenHash).Scan(&userID, &dbEmail, &expiresAt, &used)

	if err != nil {
		if err == sql.ErrNoRows {
			s.respondError(w, http.StatusBadRequest, "Invalid token")
		} else {
			s.respondError(w, http.StatusInternalServerError, "Internal server error")
		}
		return
	}

	if used {
		s.respondError(w, http.StatusBadRequest, "Token already used")
		return
	}

	if time.Now().After(expiresAt) {
		s.respondError(w, http.StatusBadRequest, "Token expired")
		return
	}

	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(r.Context(),
		`UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1`, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	_, err = tx.ExecContext(r.Context(),
		`UPDATE email_verification_tokens SET used = true WHERE token_hash = $1`, tokenHash)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	if err := tx.Commit(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"verified": true,
		"email":    dbEmail,
		"message":  "Email verified successfully",
	})
}

func (s *Server) handleResendVerificationEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		s.respondError(w, http.StatusBadRequest, "Email is required")
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "Database connection error")
		return
	}

	var userID uuid.UUID
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT id FROM auth.users WHERE email = $1`, email).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Don't leak user existence
			s.respondJSON(w, http.StatusOK, map[string]interface{}{
				"sent":    true,
				"email":   email,
				"message": "Verification email dispatched",
			})
			return
		}
		s.respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	token := hex.EncodeToString(tokenBytes)
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	_, err = s.DB.Conn.ExecContext(r.Context(),
		`INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at)
		 VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
		userID, email, tokenHash)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	// For now, log the token
	slog.Info("Verification email dispatched", "email", email, "token", token)

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"sent":    true,
		"email":   email,
		"message": "Verification email dispatched",
	})
}


