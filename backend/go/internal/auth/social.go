package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"os"

	"time"

	"github.com/google/uuid"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/github"
	"github.com/markbates/goth/providers/google"
	"github.com/markbates/goth/providers/linkedin"

	"tayari-backend/internal/config"
	"tayari-backend/internal/models"
)

const (
	stateCookieName = "oauth_state"
	stateCookieAge  = 300 // 5 minutes
)

// SetupSocialAuth configures Goth with providers
func SetupSocialAuth(cfg *config.Config) {
	goth.UseProviders(
		google.New(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL),
		github.New(cfg.GithubClientID, cfg.GithubClientSecret, cfg.GithubCallbackURL),
		linkedin.New(cfg.LinkedinClientID, cfg.LinkedinClientSecret, cfg.LinkedinCallbackURL),
	)
}

// generateState creates a cryptographically secure random state token
func generateState() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// isSecureEnv checks if we're in a secure/production environment
func isSecureEnv() bool {
	env := os.Getenv("ENVIRONMENT")
	return env == "production" || env == "staging"
}

// SocialLogin handles the redirect to the provider with CSRF protection
func (a *LocalAuth) SocialLogin(w http.ResponseWriter, r *http.Request) {
	// ponytail: state cookie is the CSRF guard. Goth does not expose PKCE; upgrade to a PKCE-capable OAuth lib if a provider requires it.
	// Generate and store state token for CSRF protection
	state, err := generateState()
	if err != nil {
		log.Printf("SocialLogin: failed to generate state: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Store state in secure cookie - derive Secure flag from environment
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    state,
		Path:     "/",
		MaxAge:   stateCookieAge,
		HttpOnly: true,
		Secure:   isSecureEnv(),
		SameSite: http.SameSiteLaxMode,
	})

	// Add state to request for Goth
	setOAuthReturnToCookie(w, r.URL.Query().Get("return_to"), a.Config.FrontendURL)
	q := r.URL.Query()
	q.Set("state", state)
	r.URL.RawQuery = q.Encode()

	gothic.BeginAuthHandler(w, r)
}

// validateEmail performs basic email validation
func validateEmail(email string) bool {
	if email == "" {
		return false
	}
	_, err := mail.ParseAddress(email)
	return err == nil
}

// SocialCallback handles the callback from the provider with state validation
func (a *LocalAuth) SocialCallback(w http.ResponseWriter, r *http.Request) {
	// Validate CSRF state
	stateCookie, err := r.Cookie(stateCookieName)
	if err != nil {
		http.Error(w, "Missing state cookie - possible CSRF attack", http.StatusForbidden)
		return
	}

	stateParam := r.URL.Query().Get("state")
	if stateParam == "" || stateParam != stateCookie.Value {
		http.Error(w, "Invalid state - possible CSRF attack", http.StatusForbidden)
		return
	}

	// Clear state cookie
	http.SetCookie(w, &http.Cookie{
		Name:   stateCookieName,
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	// Complete authentication
	user, err := gothic.CompleteUserAuth(w, r)
	if err != nil {
		log.Printf("SocialCallback: authentication failed: %v", err)
		http.Error(w, "Authentication failed", http.StatusInternalServerError)
		return
	}
	a.handleSocialCallback(w, r, user, consumeOAuthReturnTo(w, r, a.Config.FrontendURL))
}

func (a *LocalAuth) handleSocialCallback(w http.ResponseWriter, r *http.Request, gothUser goth.User, returnTo string) {
	if !validateEmail(gothUser.Email) {
		log.Printf("handleSocialCallback: invalid email from provider: %s", gothUser.Email)
		http.Error(w, "Invalid email from provider", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var dbUser models.User

	query := `SELECT id, email, role FROM auth.users WHERE email = $1`
	err := a.DB.Conn.QueryRowContext(ctx, query, gothUser.Email).Scan(&dbUser.ID, &dbUser.Email, &dbUser.Role)

	if err == sql.ErrNoRows {
		newUser, err := a.provisionSocialUser(ctx, gothUser)
		if err != nil {
			log.Printf("handleSocialCallback: failed to create user for %s: %v", gothUser.Email, err)
			http.Error(w, "Failed to create user", http.StatusInternalServerError)
			return
		}
		dbUser = *newUser
	} else if err != nil {
		log.Printf("handleSocialCallback: database error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	token, err := a.generateToken(&dbUser)
	if err != nil {
		log.Printf("handleSocialCallback: failed to generate token: %v", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// SECURITY: Use URL fragment (#) instead of query string (?)
	// Fragments are NOT sent to the server, preventing token leakage in logs
	// ponytail: redirect target is config-bound (FrontendURL, no user input in URL) → no open redirect.
	frontendURL := returnTo + "#token=" + token
	http.Redirect(w, r, frontendURL, http.StatusFound)
}

func (a *LocalAuth) provisionSocialUser(ctx context.Context, gothUser goth.User) (*models.User, error) {
	userID := uuid.New()
	role := "user"

	// Use transaction for atomic user + profile creation
	tx, err := a.DB.Conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO auth.users (id, email, role, created_at, updated_at, is_sso_user, raw_user_meta_data) 
              VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id, created_at`

	// Use parameterized JSON to prevent injection
	metaData := map[string]string{
		"full_name":  gothUser.Name,
		"avatar_url": gothUser.AvatarURL,
		"provider":   gothUser.Provider,
	}
	metaDataJSON, err := json.Marshal(metaData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user metadata: %w", err)
	}

	var user models.User
	user.Email = gothUser.Email
	user.Role = role
	now := time.Now()

	err = tx.QueryRowContext(ctx, query, userID, gothUser.Email, role, now, now, string(metaDataJSON)).Scan(&user.ID, &user.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert user: %w", err)
	}

	_, err = tx.ExecContext(ctx,
		"INSERT INTO public.profiles (id, email, full_name, avatar_url) VALUES ($1, $2, $3, $4)",
		user.ID, user.Email, gothUser.Name, gothUser.AvatarURL)

	if err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &user, nil
}
