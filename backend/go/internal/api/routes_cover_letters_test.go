package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

type coverLettersMockAuth struct {
	userID uuid.UUID
}

func (m *coverLettersMockAuth) VerifyToken(token string) (*models.User, error) {
	if token == "" || token == "invalid" {
		return nil, io.ErrUnexpectedEOF
	}
	return &models.User{ID: m.userID, Email: "candidate@example.com", Role: "user"}, nil
}
func (m *coverLettersMockAuth) Login(context.Context, string, string) (string, error) {
	return "token", nil
}
func (m *coverLettersMockAuth) Register(context.Context, string, string) (*models.User, error) {
	return &models.User{ID: m.userID, Email: "candidate@example.com", Role: "user"}, nil
}
func (m *coverLettersMockAuth) SocialLogin(http.ResponseWriter, *http.Request)    {}
func (m *coverLettersMockAuth) SocialCallback(http.ResponseWriter, *http.Request) {}

func newCoverLettersTestServer() (*Server, uuid.UUID) {
	uid := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	authMock := &coverLettersMockAuth{userID: uid}
	srv := NewServer(authMock, &config.Config{}, &database.DB{Conn: nil})
	return srv, uid
}

func TestCoverLetters_Unauthorized(t *testing.T) {
	srv, _ := newCoverLettersTestServer()

	endpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/cover-letters"},
		{"POST", "/api/v1/cover-letters"},
		{"GET", "/api/v1/cover-letters/" + uuid.New().String()},
		{"DELETE", "/api/v1/cover-letters/" + uuid.New().String()},
		{"GET", "/api/cover-letters"},
		{"POST", "/api/cover-letters"},
		{"GET", "/api/cover-letters/" + uuid.New().String()},
		{"DELETE", "/api/cover-letters/" + uuid.New().String()},
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(ep.method, ep.path, nil)
		rec := httptest.NewRecorder()
		srv.Router.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s expected 401, got %d", ep.method, ep.path, rec.Code)
		}
	}
}

func TestCoverLetters_Create_ValidatesContent(t *testing.T) {
	srv, _ := newCoverLettersTestServer()

	// Empty content
	payload := map[string]string{
		"job_title":    "Software Engineer",
		"company_name": "Acme",
		"content":      "   ",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/cover-letters", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty content, got %d", rec.Code)
	}

	// Invalid JSON
	req = httptest.NewRequest("POST", "/api/v1/cover-letters", bytes.NewReader([]byte("{invalid-json")))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid JSON, got %d", rec.Code)
	}
}

func TestCoverLetters_Create_ValidatesResumeIDFormat(t *testing.T) {
	srv, _ := newCoverLettersTestServer()

	payload := map[string]interface{}{
		"job_title":    "Software Engineer",
		"company_name": "Acme",
		"content":      "Dear Hiring Manager...",
		"resume_id":    "not-a-valid-uuid",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/cover-letters", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid resume_id UUID format, got %d", rec.Code)
	}
}

func TestCoverLetters_InvalidIDFormat(t *testing.T) {
	srv, _ := newCoverLettersTestServer()

	// GET with non-UUID id
	req := httptest.NewRequest("GET", "/api/v1/cover-letters/not-a-uuid", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid UUID in GET, got %d", rec.Code)
	}

	// DELETE with non-UUID id
	req = httptest.NewRequest("DELETE", "/api/v1/cover-letters/not-a-uuid", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid UUID in DELETE, got %d", rec.Code)
	}
}

func TestCoverLetters_List_NilDBReturnsEmptyList(t *testing.T) {
	srv, _ := newCoverLettersTestServer()

	req := httptest.NewRequest("GET", "/api/v1/cover-letters", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for nil DB list, got %d", rec.Code)
	}

	var letters []CoverLetter
	if err := json.NewDecoder(rec.Body).Decode(&letters); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(letters) != 0 {
		t.Fatalf("expected 0 letters, got %d", len(letters))
	}
}
