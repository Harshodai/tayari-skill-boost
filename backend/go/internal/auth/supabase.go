package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

type SupabaseAuth struct {
	Config *config.Config
	DB     *database.DB
}

func NewSupabaseAuth(cfg *config.Config, db *database.DB) *SupabaseAuth {
	return &SupabaseAuth{Config: cfg, DB: db}
}

// Register is not supported directly in Supabase mode (handled by frontend SDK usually)
func (a *SupabaseAuth) Register(ctx context.Context, email, password string) (*models.User, error) {
	return nil, fmt.Errorf("operation not supported in Supabase mode: use frontend SDK")
}

// Login is not supported directly in Supabase mode
func (a *SupabaseAuth) Login(ctx context.Context, email, password string) (string, error) {
	return "", fmt.Errorf("operation not supported in Supabase mode: use frontend SDK")
}

// verifyToken verifies the JWT token (HMAC with JWT Secret or Supabase logic)
func (a *SupabaseAuth) VerifyToken(tokenString string) (*models.User, error) {
	// Supabase signs tokens with HMAC using the JWT Secret
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(a.Config.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	// Enforce expiration check
	if exp, ok := claims["exp"].(float64); ok {
		if time.Now().Unix() > int64(exp) {
			return nil, ErrInvalidToken
		}
	} else {
		// Reject tokens without expiration
		return nil, ErrInvalidToken
	}

	userIDStr, ok := claims["sub"].(string)
	if !ok {
		return nil, ErrInvalidToken
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, ErrInvalidToken
	}

	role, _ := claims["role"].(string)
	email, _ := claims["email"].(string)

	return &models.User{
		ID:    userID,
		Role:  role,
		Email: email,
	}, nil
}

// =================================================================================
// Social Login Implementation (Copied/Adapted from LocalAuth to support Self-Hosted)
// =================================================================================

// Helpers are defined in social.go (package level)

func (a *SupabaseAuth) SocialLogin(w http.ResponseWriter, r *http.Request) {
	// Generate and store state token for CSRF protection
	state, err := generateState()
	if err != nil {
		log.Printf("SocialLogin: failed to generate state: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Store state in secure cookie
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
	q := r.URL.Query()
	q.Set("state", state)
	r.URL.RawQuery = q.Encode()

	gothic.BeginAuthHandler(w, r)
}

func (a *SupabaseAuth) SocialCallback(w http.ResponseWriter, r *http.Request) {
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

	// Complete authentication via Goth
	user, err := gothic.CompleteUserAuth(w, r)
	if err != nil {
		log.Printf("SocialCallback: authentication failed: %v", err)
		http.Error(w, "Authentication failed", http.StatusInternalServerError)
		return
	}
	a.handleSocialCallback(w, r, user)
}

func (a *SupabaseAuth) handleSocialCallback(w http.ResponseWriter, r *http.Request, gothUser goth.User) {
	if !validateEmail(gothUser.Email) {
		// Log sanitized email or generic message to avoid PII leak
		log.Printf("handleSocialCallback: invalid email from provider (provider: %s)", gothUser.Provider)
		http.Error(w, "Invalid email from provider", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var dbUser models.User

	// Check if user exists in auth.users
	query := `SELECT id, email, role FROM auth.users WHERE email = $1`
	err := a.DB.Conn.QueryRowContext(ctx, query, gothUser.Email).Scan(&dbUser.ID, &dbUser.Email, &dbUser.Role)

	if err == sql.ErrNoRows {
		// Provision new user
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

	// Generate JWT Token (Minting our own Supabase-compatible token)
	token, err := a.generateToken(&dbUser)
	if err != nil {
		log.Printf("handleSocialCallback: failed to generate token: %v", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Redirect to frontend with token in fragment
	frontendURL := a.Config.FrontendURL + "/auth/callback#token=" + token
	http.Redirect(w, r, frontendURL, http.StatusFound)
}

func (a *SupabaseAuth) provisionSocialUser(ctx context.Context, gothUser goth.User) (*models.User, error) {
	userID := uuid.New()
	role := "authenticated" // Default for social users

	// atomic transaction
	tx, err := a.DB.Conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert into auth.users (Supabase schema)
	query := `INSERT INTO auth.users (id, email, role, created_at, updated_at, is_sso_user, raw_user_meta_data) 
              VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id, created_at`

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

	// Insert into public.profiles
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

func (a *SupabaseAuth) generateToken(user *models.User) (string, error) {
	// Generate a token compatible with Supabase JWT standards
	claims := jwt.MapClaims{
		"sub":  user.ID.String(),
		"role": user.Role,
		"iss":  "tayari-backend",
		"exp":  time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(a.Config.JWTSecret))
}
