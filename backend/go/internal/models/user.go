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

// Profile represents the user profile (public.profiles)
type Profile struct {
	ID        uuid.UUID  `json:"id"`
	FullName  string     `json:"full_name"`
	AvatarURL string     `json:"avatar_url"`
	Email     string     `json:"email"`
	Location  string     `json:"location,omitempty"`
	Title     string     `json:"title,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}
