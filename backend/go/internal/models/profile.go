package models

import (
	"time"

	"github.com/google/uuid"
)

type Profile struct {
	ID             uuid.UUID   `json:"id"`
	FullName       string      `json:"full_name"`
	AvatarURL      string      `json:"avatar_url"`
	Email          string      `json:"email"`
	Headline       string      `json:"headline,omitempty"`
	Summary        string      `json:"summary,omitempty"`
	Skills         StringSlice `json:"skills,omitempty"`
	DesiredRoles   StringSlice `json:"desired_roles,omitempty"`
	Locations      StringSlice `json:"locations,omitempty"`
	ExperienceYears float64    `json:"experience_years,omitempty"`
	OpenToRemote   bool        `json:"open_to_remote,omitempty"`
	Links          JSONMap     `json:"links,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      *time.Time  `json:"updated_at,omitempty"`
}
