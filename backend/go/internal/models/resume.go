package models

import "time"

// Resume represents a user's uploaded resume.
type Resume struct {
	ID           int       `json:"id"`
	UserID       string    `json:"user_id"`
	Title        string    `json:"title"`
	OriginalText string    `json:"original_text,omitempty"`
	ParsedJSON   string    `json:"parsed_json,omitempty"`
	FileURL      string    `json:"file_url,omitempty"`
	FileType     string    `json:"file_type"`
	Status       string    `json:"status"` // e.g., "uploaded", "parsed", "optimized"
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// JobDescription represents a user's saved job description.
type JobDescription struct {
	ID        int       `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Company   string    `json:"company,omitempty"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}
