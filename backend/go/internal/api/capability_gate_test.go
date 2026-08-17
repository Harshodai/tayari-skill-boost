package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func TestBrowserRoutesAreLockedWhenCapabilityDisabled(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CAPABILITY_AUTONOMOUS_BROWSER", "false")
	server := NewServer(&hermesMockAuth{}, &config.Config{PythonAIURL: "http://127.0.0.1:9"}, &database.DB{Conn: nil})

	tests := []struct {
		method string
		path   string
		body   []byte
	}{
		{http.MethodPost, "/api/v1/browser/automation", []byte(`{"instruction":"x"}`)},
		{http.MethodPost, "/api/browser/automation", []byte(`{"instruction":"x"}`)},
		{http.MethodPost, "/api/v1/browser/automation/stream", []byte(`{"instruction":"x"}`)},
		{http.MethodPost, "/api/browser/automation/stream", []byte(`{"instruction":"x"}`)},
		{http.MethodPost, "/api/v1/browser/automation/cancel", []byte(`{"run_id":"run-1"}`)},
		{http.MethodPost, "/api/browser/automation/cancel", []byte(`{"run_id":"run-1"}`)},
		{http.MethodGet, "/api/v1/browser/automation/runs/run-1/control", nil},
		{http.MethodGet, "/api/browser/automation/runs/run-1/control", nil},
	}

	for _, tc := range tests {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := authReq(tc.method, tc.path, tc.body)
			rec := httptest.NewRecorder()
			server.Router.ServeHTTP(rec, req)
			if rec.Code != http.StatusLocked {
				t.Fatalf("expected 423, got %d: %s", rec.Code, rec.Body.String())
			}
			if !containsAll(rec.Body.String(), `"code":"disabled_by_launch_scope"`, `"capability":"autonomous.browser"`) {
				t.Fatalf("unexpected disabled response: %s", rec.Body.String())
			}
		})
	}
}

func containsAll(value string, expected ...string) bool {
	for _, item := range expected {
		if !strings.Contains(value, item) {
			return false
		}
	}
	return true
}
