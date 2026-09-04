package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTracePropagation_ForwardedToPython(t *testing.T) {
	srv := newSmokeServer(t)
	var gotTrace string
	respBytes, _ := json.Marshal(map[string]any{"actions": []any{}})
	srv.AI.SetTransport(roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		gotTrace = req.Header.Get("X-Request-ID")
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(respBytes)),
		}, nil
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/career/next-actions", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token")
	req.Header.Set("X-Request-ID", "trace-e2e-1")
	rec := httptest.NewRecorder()
	srv.Router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (body=%s)", rec.Code, rec.Body.String())
	}
	if gotTrace != "trace-e2e-1" {
		t.Fatalf("X-Request-ID not propagated to Python: got %q", gotTrace)
	}
}
