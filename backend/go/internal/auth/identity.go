package auth

import (
	"context"
	"tayari-backend/internal/models"

	"github.com/google/uuid"
)

type AuthMethod string

const (
	AuthMethodUserJWT    AuthMethod = "user_jwt"
	AuthMethodServiceJWT AuthMethod = "service_jwt"
	AuthMethodLegacy     AuthMethod = "legacy_compatibility"
)

type Identity struct {
	UserID    uuid.UUID
	TenantID  *uuid.UUID
	Roles     []string
	TokenID   string
	Method    AuthMethod
	IsService bool
	Email     string
	User      *models.User
}

// AuthorizationContext is the request-scoped authorization snapshot. It is
// populated only after token verification and must be treated as immutable by
// downstream handlers; tenant selection from Host/X-Tenant-Domain is never a
// substitute for the verified subject or membership check.
type AuthorizationContext struct {
	Subject   uuid.UUID
	TenantID  uuid.UUID
	Roles     []string
	RequestID string
	Epoch     int64
}

type authorizationContextKey struct{}

func WithAuthorizationContext(ctx context.Context, authorization *AuthorizationContext) context.Context {
	if authorization == nil {
		return ctx
	}
	roles := append([]string(nil), authorization.Roles...)
	copyValue := *authorization
	copyValue.Roles = roles
	return context.WithValue(ctx, authorizationContextKey{}, &copyValue)
}

func AuthorizationContextFromContext(ctx context.Context) (*AuthorizationContext, bool) {
	authorization, ok := ctx.Value(authorizationContextKey{}).(*AuthorizationContext)
	return authorization, ok && authorization != nil
}

type IdentityVerifier interface {
	VerifyIdentity(token string) (*Identity, error)
}

type identityContextKey struct{}

func WithIdentityContext(ctx context.Context, identity *Identity) context.Context {
	return context.WithValue(ctx, identityContextKey{}, identity)
}

func IdentityFromContext(ctx context.Context) (*Identity, bool) {
	identity, ok := ctx.Value(identityContextKey{}).(*Identity)
	return identity, ok && identity != nil
}
