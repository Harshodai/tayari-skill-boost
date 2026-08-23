package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func TestAuthRateLimit_NoRow_ReturnsAllowedDefault(t *testing.T) {
	// ponytail: self-contained server — don't couple to newResumeGraphServer
	// (that helper lives in an untracked file and would break this test in isolation).
	srv := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/rate-limit",
		strings.NewReader(`{"email":"nobody@example.com"}`))
	req.Header.Set("Content-Type", "application/json")
	srv.Router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["allowed"] != true {
		t.Errorf("expected allowed=true when no DB, got %v", resp["allowed"])
	}
	if int(resp["remainingAttempts"].(float64)) != 5 {
		t.Errorf("expected 5 remaining when no DB, got %v", resp["remainingAttempts"])
	}
}

func TestAuthRateLimit_MissingEmail_Returns400(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/auth/rate-limit", []byte(`{}`)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing email, got %d", w.Code)
	}
}

func TestAuthRateLimit_EmptyEmail_Returns400(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/auth/rate-limit", []byte(`{"email":""}`)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty email, got %d", w.Code)
	}
}

func TestAuthRateLimit_MalformedJSON_Returns400(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/auth/rate-limit", []byte(`not-json`)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed JSON, got %d", w.Code)
	}
}

func TestAuthRateLimit_AliasRouteAlsoAcceptsPost(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/auth/rate-limit", []byte(`{"email":"a@b.com"}`)))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
