package auth

import (
	"context"
	"fmt"
    "net/http"
    
	"github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "tayari-backend/internal/config"
    "tayari-backend/internal/models"
)

type SupabaseAuth struct {
	Config *config.Config
}

func NewSupabaseAuth(cfg *config.Config) *SupabaseAuth {
	return &SupabaseAuth{Config: cfg}
}

// Register is not supported in Backend-Proxy for Supabase mode usually
// The frontend calls Supabase SDK directly.
func (a *SupabaseAuth) Register(ctx context.Context, email, password string) (*models.User, error) {
	return nil, fmt.Errorf("operation not supported in Supabase mode: use frontend SDK")
}

// Login is not supported in Backend-Proxy for Supabase mode usually
func (a *SupabaseAuth) Login(ctx context.Context, email, password string) (string, error) {
	return "", fmt.Errorf("operation not supported in Supabase mode: use frontend SDK")
}

// SocialLogin is not supported in proxy mode for Supabase (handled by SDK)
func (a *SupabaseAuth) SocialLogin(w http.ResponseWriter, r *http.Request) {
    http.Error(w, "Social Auth handled by Frontend SDK in Supabase Mode", http.StatusNotImplemented)
}

// SocialCallback is not supported
func (a *SupabaseAuth) SocialCallback(w http.ResponseWriter, r *http.Request) {
    http.Error(w, "Social Auth handled by Frontend SDK in Supabase Mode", http.StatusNotImplemented)
}

func (a *SupabaseAuth) VerifyToken(tokenString string) (*models.User, error) {
    // Supabase signs tokens with HMAC using the JWT Secret (which corresponds to the API Key typically or a specific JWT secret)
    // For this implementation, we assume Config.JWTSecret holds the Supabase JWT Secret
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

	userIDStr, ok := claims["sub"].(string)
    if !ok {
        return nil, ErrInvalidToken
    }
    
    userID, err := uuid.Parse(userIDStr)
    if err != nil {
        return nil, ErrInvalidToken
    }
    
    role, _ := claims["role"].(string)

	return &models.User{
        ID: userID,
        Role: role,
    }, nil
}
