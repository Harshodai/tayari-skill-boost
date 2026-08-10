package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestAgentReachDoctorPlatformName_BrandingInSync guards the backend's
// agent-reach doctor platform_name against the stale product name. The
// branding gate lives in src/config/branding.test.ts and can only see
// src/ + index.html, so this backend payload must be kept in sync by hand.
func TestAgentReachDoctorPlatformName_BrandingInSync(t *testing.T) {
	server := newHermesServer(t, "http://127.0.0.1:1")
	for _, path := range []string{"/api/v1/agent-reach/doctor", "/api/agent-reach/doctor"} {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, authReq(http.MethodPost, path, nil))
		if w.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", path, w.Code, w.Body.String())
		}
		var resp map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("%s: decode response: %v", path, err)
		}
		if got := resp["platform_name"]; got != "Job Tayari Candidate Intelligence Suite" {
			t.Fatalf("%s: platform_name = %q, want %q", path, got, "Job Tayari Candidate Intelligence Suite")
		}
	}
}
