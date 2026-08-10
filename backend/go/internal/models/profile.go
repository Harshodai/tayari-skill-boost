package models

import (
	"time"

	"github.com/google/uuid"
)

type Profile struct {
	ID              uuid.UUID   `json:"id"`
	FullName        string      `json:"full_name"`
	AvatarURL       string      `json:"avatar_url"`
	Email           string      `json:"email"`
	Headline        string      `json:"headline,omitempty"`
	Summary         string      `json:"summary,omitempty"`
	Skills          StringSlice `json:"skills,omitempty"`
	DesiredRoles    StringSlice `json:"desired_roles,omitempty"`
	Locations       StringSlice `json:"locations,omitempty"`
	ExperienceYears float64     `json:"experience_years,omitempty"`
	OpenToRemote    bool        `json:"open_to_remote,omitempty"`
	Links           JSONMap     `json:"links,omitempty"`
	// ponytail: career-goal fields (P0 audit fix Q3) mirror the Onboarding
	// wizard payload; transition_type is DB CHECK-constrained to the two tracks.
	TransitionType     string      `json:"transition_type,omitempty"`
	CurrentTitle       string      `json:"current_title,omitempty"`
	TargetLevel        string      `json:"target_level,omitempty"`
	CurrentIndustry    string      `json:"current_industry,omitempty"`
	TargetIndustry     string      `json:"target_industry,omitempty"`
	TransferableSkills StringSlice `json:"transferable_skills,omitempty"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          *time.Time  `json:"updated_at,omitempty"`
}
