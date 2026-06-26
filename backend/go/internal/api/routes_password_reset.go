package api

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (s *Server) routesPasswordReset(r chi.Router) {
	r.Post("/api/auth/forgot-password", s.handleForgotPassword)
	r.Post("/api/v1/auth/forgot-password", s.handleForgotPassword)
	r.Post("/api/auth/reset-password", s.handleResetPassword)
	r.Post("/api/v1/auth/reset-password", s.handleResetPassword)
}

func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		s.respondError(w, http.StatusBadRequest, "Email is required")
		return
	}

	var userID uuid.UUID
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT id FROM auth.users WHERE email=$1`, req.Email).Scan(&userID)
	if err == nil {
		tokenBytes := make([]byte, 32)
		if _, err := rand.Read(tokenBytes); err != nil {
			log.Printf("handleForgotPassword: failed to generate token: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to generate reset token")
			return
		}
		token := hex.EncodeToString(tokenBytes)

		_, err = s.DB.Conn.ExecContext(r.Context(),
			`INSERT INTO public.password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
			userID, token)
		if err != nil {
			log.Printf("handleForgotPassword: failed to store token: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to create reset token")
			return
		}

		frontendURL := strings.TrimRight(s.Config.FrontendURL, "/")
		if err := sendPasswordResetEmail(req.Email, token, frontendURL); err != nil {
			log.Printf("handleForgotPassword: failed to send email: %v", err)
		}
	} else {
		log.Printf("handleForgotPassword: email not found (not revealing): %s", req.Email)
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"message": "If the email exists, a reset link has been sent.",
	})
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" || req.Password == "" {
		s.respondError(w, http.StatusBadRequest, "Token and password are required")
		return
	}
	if len(req.Password) < 8 {
		s.respondError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	var tokenID int
	var userID uuid.UUID
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT id, user_id FROM public.password_reset_tokens WHERE token=$1 AND used=false AND expires_at > NOW()`,
		req.Token).Scan(&tokenID, &userID)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid or expired reset token")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("handleResetPassword: bcrypt error: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("handleResetPassword: tx begin: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to reset password")
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(r.Context(),
		`UPDATE auth.users SET encrypted_password=$1, updated_at=NOW() WHERE id=$2`,
		string(hash), userID)
	if err != nil {
		log.Printf("handleResetPassword: update password: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to reset password")
		return
	}

	_, err = tx.ExecContext(r.Context(),
		`UPDATE public.password_reset_tokens SET used=true WHERE id=$1`, tokenID)
	if err != nil {
		log.Printf("handleResetPassword: mark token used: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to reset password")
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("handleResetPassword: tx commit: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to reset password")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"message": "Password has been reset successfully.",
	})
}

func sendPasswordResetEmail(email, token, frontendURL string) error {
	apiKey := os.Getenv("SENDGRID_API_KEY")
	if apiKey == "" {
		log.Printf("[sendPasswordResetEmail] SENDGRID_API_KEY not set; would send reset link: %s/reset-password?token=%s", frontendURL, token)
		return nil
	}

	resetLink := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, token)

	payload := map[string]interface{}{
		"personalizations": []map[string]interface{}{
			{
				"to": []map[string]string{
					{"email": email},
				},
				"subject": "Reset Your Tayari Password",
			},
		},
		"from": map[string]string{
			"email": "noreply@tayari.app",
		},
		"content": []map[string]string{
			{
				"type":  "text/html",
				"value": fmt.Sprintf(`<p>We received a request to reset your Tayari password.</p><p>Click the link below to reset your password:</p><p><a href="%s">Reset Password</a></p><p>If you did not request this, please ignore this email.</p><p>This link will expire in 1 hour.</p>`, resetLink),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.sendgrid.com/v3/mail/send", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("sendgrid request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sendgrid status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}


