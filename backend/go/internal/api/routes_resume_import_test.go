package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJobDescriptionImport_ValidatesAndForwardsURL(t *testing.T) {
	called := 0
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called++
		if r.Method != http.MethodPost || r.URL.Path != "/api/v1/job-descriptions/import" {
			t.Fatalf("unexpected upstream request: %s %s", r.Method, r.URL.Path)
		}
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode upstream body: %v", err)
		}
		if payload["url"] != "https://jobs.example.com/role" {
			t.Fatalf("unexpected URL payload: %#v", payload)
		}
		_, _ = io.WriteString(w, `{"url":"https://jobs.example.com/role","title":"Backend Engineer","job_description":"Build reliable systems."}`)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	for _, path := range []string{"/api/v1/job-descriptions/import", "/api/job-descriptions/import"} {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, authReq(http.MethodPost, path, []byte(`{"url":" https://jobs.example.com/role "}`)))
		if w.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", path, w.Code, w.Body.String())
		}
	}

	if called != 2 {
		t.Fatalf("expected both import routes to be forwarded to Python, got %d calls", called)
	}
}

func TestJobDescriptionImport_RejectsMalformedOrBlankRequests(t *testing.T) {
	server := newHermesServer(t, "http://127.0.0.1:1")
	for _, body := range [][]byte{[]byte(`{`), []byte(`{"url":"   "}`)} {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/job-descriptions/import", body))
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
		}
	}
}

func TestAnalyzeText_RejectsMissingInputsInsteadOfUsingFallbacks(t *testing.T) {
	server := newHermesServer(t, "http://127.0.0.1:1")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/analyze", []byte(`{}`)))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var response map[string]string
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response["error"] == "" {
		t.Fatal("expected a clear missing-input error")
	}
}

func TestAnalyzeText_ForwardsCustomInstructions(t *testing.T) {
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode upstream body: %v", err)
		}
		if payload["custom_instructions"] != "Prioritize leadership impact." {
			t.Fatalf("custom instructions were not forwarded: %#v", payload)
		}
		_, _ = io.WriteString(w, `{}`)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/analyze", []byte(`{
        "resume_text":"Experienced backend engineer.",
        "job_description":"Build distributed systems.",
        "custom_instructions":"Prioritize leadership impact."
    }`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
