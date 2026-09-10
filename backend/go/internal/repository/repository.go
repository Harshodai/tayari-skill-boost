package repository

import (
	"context"
	"errors"
	"time"
)

var (
	// ErrNotFound is returned when a requested record is not found or not owned by user.
	ErrNotFound = errors.New("record not found")
	// ErrInvalidUser is returned when a user ID is empty or a synthetic identity.
	ErrInvalidUser = errors.New("invalid user ID: synthetic or empty identity rejected")
)

// Resume represents a candidate resume domain entity.
type Resume struct {
	ID           int64     `json:"id"`
	UserID       string    `json:"user_id"`
	Title        string    `json:"title"`
	OriginalText string    `json:"original_text"`
	FileType     string    `json:"file_type"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

// ResumeRepository defines the contract for resume persistence.
type ResumeRepository interface {
	Create(ctx context.Context, userID, title, text, fileType string) (int64, error)
	GetByID(ctx context.Context, userID string, id int64) (*Resume, error)
	ListByUser(ctx context.Context, userID string, limit int) ([]Resume, error)
	Update(ctx context.Context, userID string, id int64, title, text, fileType string) error
	Delete(ctx context.Context, userID string, id int64) error
}

// CoverLetter represents a generated or custom cover letter domain entity.
type CoverLetter struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	JobTitle  string    `json:"job_title"`
	Company   string    `json:"company"`
	Tone      string    `json:"tone"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

// CoverLetterRepository defines the contract for cover letter persistence.
type CoverLetterRepository interface {
	Create(ctx context.Context, cl *CoverLetter) (string, error)
	ListByUser(ctx context.Context, userID string) ([]CoverLetter, error)
	Delete(ctx context.Context, userID, id string) error
}

// Application represents a job application tracking entity.
type Application struct {
	ID        int64     `json:"id"`
	UserID    string    `json:"user_id"`
	Company   string    `json:"company"`
	JobTitle  string    `json:"job_title"`
	JobURL    string    `json:"job_url"`
	Stage     string    `json:"stage"`
	CreatedAt time.Time `json:"created_at"`
}

// ApplicationRepository defines the contract for application persistence.
type ApplicationRepository interface {
	Create(ctx context.Context, app *Application) (int64, error)
	GetByID(ctx context.Context, userID string, id int64) (*Application, error)
	ListByUser(ctx context.Context, userID string, limit, offset int) ([]Application, error)
	UpdateStage(ctx context.Context, userID string, id int64, stage string) error
}

// Repositories aggregates all repository interfaces.
type Repositories struct {
	Resumes      ResumeRepository
	CoverLetters CoverLetterRepository
	Applications ApplicationRepository
}
