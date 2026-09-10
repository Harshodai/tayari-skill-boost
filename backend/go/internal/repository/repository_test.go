package repository

import (
	"context"
	"errors"
	"testing"
)

func TestValidateUserID(t *testing.T) {
	tests := []struct {
		userID  string
		wantErr bool
	}{
		{"", true},
		{"   ", true},
		{"default_user", true},
		{"DEFAULT_USER", true},
		{"candidate", true},
		{"unknown", true},
		{"anonymous", true},
		{"system", true},
		{"usr_1234567890", false},
		{"11111111-2222-3333-4444-555555555555", false},
	}

	for _, tt := range tests {
		err := validateUserID(tt.userID)
		if (err != nil) != tt.wantErr {
			t.Errorf("validateUserID(%q) error = %v, wantErr %v", tt.userID, err, tt.wantErr)
		}
	}
}

func TestMockResumeRepo_CRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewMockResumeRepo()
	userID := "usr_valid_user_1"

	// Create
	id, err := repo.Create(ctx, userID, "Software Engineer", "Experienced Go developer", "application/pdf")
	if err != nil {
		t.Fatalf("unexpected error creating resume: %v", err)
	}
	if id <= 0 {
		t.Fatalf("expected positive id, got %d", id)
	}

	// Synthetic identity rejected
	_, err = repo.Create(ctx, "default_user", "Fake Resume", "text", "pdf")
	if !errors.Is(err, ErrInvalidUser) {
		t.Fatalf("expected ErrInvalidUser for synthetic user, got %v", err)
	}

	// GetByID
	res, err := repo.GetByID(ctx, userID, id)
	if err != nil {
		t.Fatalf("unexpected error getting resume: %v", err)
	}
	if res.Title != "Software Engineer" {
		t.Errorf("expected title 'Software Engineer', got %q", res.Title)
	}

	// GetByID other user -> ErrNotFound
	_, err = repo.GetByID(ctx, "usr_other_user", id)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound for cross-user get, got %v", err)
	}

	// ListByUser
	list, err := repo.ListByUser(ctx, userID, 10)
	if err != nil {
		t.Fatalf("unexpected error listing resumes: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 resume in list, got %d", len(list))
	}

	// Update
	err = repo.Update(ctx, userID, id, "Senior Software Engineer", "Updated text", "application/pdf")
	if err != nil {
		t.Fatalf("unexpected error updating resume: %v", err)
	}
	res, _ = repo.GetByID(ctx, userID, id)
	if res.Title != "Senior Software Engineer" {
		t.Errorf("expected updated title, got %q", res.Title)
	}

	// Delete
	err = repo.Delete(ctx, userID, id)
	if err != nil {
		t.Fatalf("unexpected error deleting resume: %v", err)
	}

	// Get after delete -> ErrNotFound
	_, err = repo.GetByID(ctx, userID, id)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound after deletion, got %v", err)
	}
}

func TestMockCoverLetterRepo_CRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewMockCoverLetterRepo()
	userID := "usr_valid_user_1"

	cl := &CoverLetter{
		UserID:   userID,
		JobTitle: "Staff Engineer",
		Company:  "Acme Corp",
		Tone:     "confident",
		Body:     "Dear Team, I am writing to express interest...",
	}

	// Create
	id, err := repo.Create(ctx, cl)
	if err != nil {
		t.Fatalf("unexpected error creating cover letter: %v", err)
	}
	if id == "" {
		t.Fatalf("expected non-empty id")
	}

	// List
	list, err := repo.ListByUser(ctx, userID)
	if err != nil {
		t.Fatalf("unexpected error listing cover letters: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 cover letter, got %d", len(list))
	}
	if list[0].Company != "Acme Corp" {
		t.Errorf("expected company 'Acme Corp', got %q", list[0].Company)
	}

	// Delete
	err = repo.Delete(ctx, userID, id)
	if err != nil {
		t.Fatalf("unexpected error deleting cover letter: %v", err)
	}

	// Delete again -> ErrNotFound
	err = repo.Delete(ctx, userID, id)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound on second delete, got %v", err)
	}
}

func TestMockAppRepo_CRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewMockAppRepo()
	userID := "usr_valid_user_1"

	app := &Application{
		UserID:   userID,
		Company:  "Tech Start",
		JobTitle: "Backend Lead",
		JobURL:   "https://jobs.example.com/123",
		Stage:    "applied",
	}

	// Create
	id, err := repo.Create(ctx, app)
	if err != nil {
		t.Fatalf("unexpected error creating application: %v", err)
	}
	if id <= 0 {
		t.Fatalf("expected positive id, got %d", id)
	}

	// GetByID
	got, err := repo.GetByID(ctx, userID, id)
	if err != nil {
		t.Fatalf("unexpected error getting application: %v", err)
	}
	if got.Company != "Tech Start" || got.Stage != "applied" {
		t.Errorf("unexpected retrieved app data: %+v", got)
	}

	// UpdateStage
	err = repo.UpdateStage(ctx, userID, id, "interview")
	if err != nil {
		t.Fatalf("unexpected error updating stage: %v", err)
	}
	got, _ = repo.GetByID(ctx, userID, id)
	if got.Stage != "interview" {
		t.Errorf("expected stage 'interview', got %q", got.Stage)
	}

	// List
	list, err := repo.ListByUser(ctx, userID, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error listing applications: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 application in list, got %d", len(list))
	}
}

func TestNewPostgresRepositories_NilDB(t *testing.T) {
	repos := NewPostgresRepositories(nil)
	if repos != nil {
		t.Fatalf("expected nil repositories for nil DB, got %+v", repos)
	}
}
