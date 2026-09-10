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
	"tayari-backend/internal/repository"
)

type repoMockAuth struct {
	user *models.User
}

func (m *repoMockAuth) VerifyToken(token string) (*models.User, error) {
	if token == "" || token == "invalid" {
		return nil, io.ErrUnexpectedEOF
	}
	return m.user, nil
}
func (m *repoMockAuth) Login(context.Context, string, string) (string, error) {
	return "token", nil
}
func (m *repoMockAuth) Register(context.Context, string, string) (*models.User, error) {
	return m.user, nil
}
func (m *repoMockAuth) SocialLogin(http.ResponseWriter, *http.Request)    {}
func (m *repoMockAuth) SocialCallback(http.ResponseWriter, *http.Request) {}

func newRepoTestServer() (*Server, *models.User, *repository.Repositories) {
	uid := uuid.MustParse("22222222-3333-4444-5555-666666666666")
	user := &models.User{ID: uid, Email: "repo_test@example.com", Role: "user"}
	authMock := &repoMockAuth{user: user}

	srv := NewServer(authMock, &config.Config{}, &database.DB{Conn: nil})
	mockRepos := repository.NewMockRepositories()
	srv.Repos = mockRepos
	return srv, user, mockRepos
}

func TestResumeHandlers_WithRepository(t *testing.T) {
	srv, _, _ := newRepoTestServer()

	// 1. Create Resume
	createBody := map[string]string{
		"title":         "Lead Backend Engineer",
		"original_text": "Experienced in Go, distributed systems, and PostgreSQL",
		"file_type":     "application/pdf",
	}
	body, _ := json.Marshal(createBody)
	req := httptest.NewRequest("POST", "/api/v1/resumes", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for create resume, got %d: %s", rec.Code, rec.Body.String())
	}
	var created map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	idFloat, ok := created["id"].(float64)
	if !ok || idFloat <= 0 {
		t.Fatalf("expected positive resume id, got %v", created["id"])
	}

	// 2. List Resumes
	req = httptest.NewRequest("GET", "/api/v1/resumes", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for list resumes, got %d", rec.Code)
	}
	var list []map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 resume in list, got %d", len(list))
	}
	if list[0]["title"] != "Lead Backend Engineer" {
		t.Errorf("expected title 'Lead Backend Engineer', got %v", list[0]["title"])
	}

	// 3. Get Resume
	req = httptest.NewRequest("GET", "/api/v1/resumes/1", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for get resume, got %d: %s", rec.Code, rec.Body.String())
	}
	var res models.Resume
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode get resume: %v", err)
	}
	if res.Title != "Lead Backend Engineer" {
		t.Errorf("expected title 'Lead Backend Engineer', got %q", res.Title)
	}

	// 4. Update Resume
	updateBody := map[string]string{
		"title":         "Principal Backend Engineer",
		"original_text": "Updated content",
		"file_type":     "application/pdf",
	}
	body, _ = json.Marshal(updateBody)
	req = httptest.NewRequest("PUT", "/api/v1/resumes/1", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for update resume, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify Update
	req = httptest.NewRequest("GET", "/api/v1/resumes/1", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode get resume: %v", err)
	}
	if res.Title != "Principal Backend Engineer" {
		t.Errorf("expected updated title 'Principal Backend Engineer', got %q", res.Title)
	}

	// 5. Delete Resume
	req = httptest.NewRequest("DELETE", "/api/v1/resumes/1", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for delete resume, got %d", rec.Code)
	}

	// 6. Get Deleted Resume -> 404
	req = httptest.NewRequest("GET", "/api/v1/resumes/1", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for deleted resume, got %d", rec.Code)
	}
}

func TestCoverLetterHandlers_WithRepository(t *testing.T) {
	srv, _, _ := newRepoTestServer()

	// 1. Create Cover Letter
	createBody := map[string]string{
		"job_title":    "Senior SRE",
		"company_name": "Globex",
		"content":      "I am excited to apply for the Senior SRE role at Globex.",
		"job_url":      "https://globex.example.com/jobs/1",
	}
	body, _ := json.Marshal(createBody)
	req := httptest.NewRequest("POST", "/api/v1/cover-letters", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create cover letter, got %d: %s", rec.Code, rec.Body.String())
	}
	var created CoverLetter
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode created cover letter: %v", err)
	}
	if created.ID == "" {
		t.Fatalf("expected non-empty cover letter id")
	}
	if created.CompanyName != "Globex" {
		t.Errorf("expected company_name 'Globex', got %q", created.CompanyName)
	}

	// 2. List Cover Letters
	req = httptest.NewRequest("GET", "/api/v1/cover-letters", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for list cover letters, got %d", rec.Code)
	}
	var list []CoverLetter
	if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode cover letter list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 cover letter in list, got %d", len(list))
	}
	if list[0].JobTitle != "Senior SRE" {
		t.Errorf("expected job_title 'Senior SRE', got %q", list[0].JobTitle)
	}

	// 3. Delete Cover Letter
	req = httptest.NewRequest("DELETE", "/api/v1/cover-letters/"+created.ID, nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for delete cover letter, got %d: %s", rec.Code, rec.Body.String())
	}

	// 4. Delete again -> 404
	req = httptest.NewRequest("DELETE", "/api/v1/cover-letters/"+created.ID, nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec = httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 on deleting non-existent cover letter, got %d", rec.Code)
	}
}
