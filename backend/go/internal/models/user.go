package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system (matches auth.users simulation)
type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	// Internal fields not exposed via JSON usually
	PasswordHash string `json:"-"`
}
