package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func newBrowserServer(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
}

const browserResult = `{"success":true,"summary":"Applied to the role","visited_urls":["https://example.com/jobs/1"]}`

func TestBrowserAutomation_ProxiesToPython(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/browser/automation" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, browserResult)
	})
	defer srv.Close()

	server := newBrowserServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/browser/automation",
		[]byte(`{"instruction":"Apply to the job"}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Applied to the role") {
		t.Errorf("expected passthrough, got %s", w.Body.String())
	}
}

func TestBrowserAutomation_AliasRouteAlsoProxies(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, browserResult)
	})
	defer srv.Close()

	server := newBrowserServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/browser/automation",
		[]byte(`{"instruction":"x"}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBrowserAutomation_ForwardsPython503(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, `{"error":"ai_service_unavailable"}`)
	})
	defer srv.Close()

	server := newBrowserServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/browser/automation",
		[]byte(`{"instruction":"x"}`)))

	// ponytail: the pre-existing plain proxy maps upstream errors to 502
	// (its established contract); only the new stream route preserves status.
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBrowserAutomationStream_PassesEventsThrough(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/browser/automation/stream" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "data: {\"type\":\"screenshot\",\"step\":1,\"data\":\"aGVsbG8=\"}\n\ndata: {\"type\":\"done\"}\n\n")
	})
	defer srv.Close()

	server := newBrowserServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/browser/automation/stream",
		[]byte(`{"instruction":"Apply"}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("expected text/event-stream, got %q", w.Header().Get("Content-Type"))
	}
	if !strings.Contains(w.Body.String(), "screenshot") || !strings.Contains(w.Body.String(), "done") {
		t.Errorf("expected events forwarded, got %s", w.Body.String())
	}
}

func TestBrowserAutomationStream_ForwardsUpstream503(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, `{"error":"ai_service_unavailable"}`)
	})
	defer srv.Close()

	server := newBrowserServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/browser/automation/stream",
		[]byte(`{"instruction":"x"}`)))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", w.Code, w.Body.String())
	}
}
