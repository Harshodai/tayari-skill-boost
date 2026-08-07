package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func TestAuthRateLimit_NoRow_ReturnsAllowedDefault(t *testing.T) {
	// ponytail: self-contained server — don't couple to newResumeGraphServer
	// (that helper lives in an untracked file and would break this test in isolation).
	srv := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/rate-limit?email=nobody@example.com", nil)
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

func TestAuthRateLimit_MissingEmailParam_Returns400(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/auth/rate-limit", nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing email, got %d", w.Code)
	}
}