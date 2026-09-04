package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestCareerNextActions_RejectsAnonymous(t *testing.T) {
	srv := newSmokeServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/career/next-actions", nil)
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for anonymous request, got %d", rec.Code)
	}
}

func TestCareerNextActions_AuthenticatedProxy(t *testing.T) {
	srv := newSmokeServer(t)

	called := false
	mockResp := map[string]interface{}{
		"actions": []interface{}{
			map[string]interface{}{
				"action_id":                     "act-1",
				"type":                          "resume_optimization",
				"title":                         "Optimize resume for target role",
				"why_now":                       "Increase keyword match",
				"effort_estimate_mins":          10,
				"confidence":                    0.9,
				"status_badge":                  "inferred",
				"freshness_ts":                  "2026-09-03T10:00:00Z",
				"required_action_by_candidate": "Run optimization",
				"evidence_url":                  "/resume/results",
			},
		},
	}
	respBytes, _ := json.Marshal(mockResp)

	srv.AI.SetTransport(roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		called = true
		if req.URL.Path != "/api/v1/career/next-actions" {
			t.Errorf("unexpected upstream path: %s", req.URL.Path)
		}
		if req.Header.Get("X-User-Id") == "" {
			t.Errorf("missing X-User-Id forwarded header")
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(respBytes)),
		}, nil
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/career/next-actions", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)

	if !called {
		t.Fatalf("expected AI transport to be called")
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for authenticated request, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}
	actions, ok := resp["actions"].([]interface{})
	if !ok || len(actions) != 1 {
		t.Fatalf("expected 1 action, got: %v", resp)
	}
}
