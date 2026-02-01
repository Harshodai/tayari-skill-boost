package auth

import (
	"context"
	"errors"
    "net/http"
    "tayari-backend/internal/models"
)

// AuthService defines the interface for authentication operations
// This allows us to swap between Local Postgres Auth and Supabase Auth
type AuthService interface {
	// VerifyToken validates a JWT and returns the User ID and claims
	VerifyToken(token string) (*models.User, error)
	
    // Login performs login (Local only, Supabase handles this on client usually)
    // For Unified API, we might implement a proxy
    Login(ctx context.Context, email, password string) (string, error)

    // Register creates a new user (Local only)
    Register(ctx context.Context, email, password string) (*models.User, error)
    
    // Social Login Helpers
    SocialLogin(w http.ResponseWriter, r *http.Request)
    SocialCallback(w http.ResponseWriter, r *http.Request)
}

// Common errors
var (
    ErrInvalidToken = errors.New("invalid token")
    ErrUnauthorized = errors.New("unauthorized")
)
