package models

import (
	"time"
)

// SavedJob represents a job saved by a user.
type SavedJob struct {
	ID          int       `json:"id"`
	UserID      string    `json:"user_id"`
	DedupeKey   string    `json:"dedupe_key"`
	Job         JSONMap   `json:"job"`
	Status      string    `json:"status"` // e.g., "saved", "applied", "interviewing", "offer", "rejected"
	SavedAt     time.Time `json:"saved_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
