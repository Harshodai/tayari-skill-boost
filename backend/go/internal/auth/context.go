package auth

import (
	"context"
	"tayari-backend/internal/models"
)

type contextKey string

const ContextKeyUser contextKey = "user"

// UserFromContext retrieves the authenticated *models.User from context.
func UserFromContext(ctx context.Context) (*models.User, bool) {
	u, ok := ctx.Value(ContextKeyUser).(*models.User)
	if !ok || u == nil {
		return nil, false
	}
	return u, true
}

// WithUserContext returns a new context with the given user attached.
func WithUserContext(ctx context.Context, user *models.User) context.Context {
	return context.WithValue(ctx, ContextKeyUser, user)
}
