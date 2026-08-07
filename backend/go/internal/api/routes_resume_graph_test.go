package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func newResumeGraphServer(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
}

func TestResumeGraphGet_ProxiesToPythonAndReturns200(t *testing.T) {
	graphJSON := `{"nodes":[{"id":"1","label":"Go"}],"links":[]}`
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/v1/resume-graph/run-1" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("format") != "raw" {
			t.Errorf("expected format=raw to be forwarded, got %q", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, graphJSON)
	})
	defer srv.Close()

	server := newResumeGraphServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/resume-graph/run-1?format=raw", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if _, ok := resp["nodes"]; !ok {
		t.Errorf("expected nodes in response body: %s", w.Body.String())
	}
}

func TestResumeGraphGet_ForwardPython404(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, `{"detail":"Resume graph not found"}`)
	})
	defer srv.Close()

	server := newResumeGraphServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/resume-graph/unknown", nil))

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 passthrough, got %d", w.Code)
	}
}

func TestResumeGraphGet_ForwardPython429(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = io.WriteString(w, `{"detail":"Too many requests"}`)
	})
	defer srv.Close()

	server := newResumeGraphServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/resume-graph/run-1?format=raw", nil))

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 passthrough, got %d", w.Code)
	}
}

func TestResumeGraphExport_ReturnsBlobWithContentDisposition(t *testing.T) {
	raw := `{"nodes":[{"id":"1","label":"Go"}],"links":[]}`
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/v1/resume-graph/run-1/export" {
			t.Errorf("unexpected upstream call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="resume-graph-run-1.json"`)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, raw)
	})
	defer srv.Close()

	server := newResumeGraphServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/resume-graph/run-1/export", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json content type, got %q", ct)
	}
	if cd := w.Header().Get("Content-Disposition"); !strings.Contains(cd, "resume-graph-run-1.json") {
		t.Errorf("expected Content-Disposition filename, got %q", cd)
	}
	if w.Body.String() != raw {
		t.Errorf("expected raw body passthrough, got %s", w.Body.String())
	}
}

func TestResumeGraphDelete_ProxiesToPython(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("unexpected method: %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	})
	defer srv.Close()

	server := newResumeGraphServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodDelete, "/api/v1/resume-graph/run-1", nil))

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 passthrough, got %d", w.Code)
	}
}

func TestResumeGraphPost_ForwardsBodyToPython(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/resume-graph" {
			t.Errorf("unexpected upstream call: %s %s", r.Method, r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "run-1") {
			t.Errorf("expected run_id forwarded in body, got %s", string(body))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"run_id":"run-1","graph":{"nodes":[],"links":[]}}`)
	})
	defer srv.Close()

	server := newResumeGraphServer(t, srv.URL)
	body := []byte(`{"run_id":"run-1","resume_text":"hello"}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resume-graph", body))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp["run_id"] != "run-1" {
		t.Errorf("expected run_id in response, got %s", w.Body.String())
	}
}
