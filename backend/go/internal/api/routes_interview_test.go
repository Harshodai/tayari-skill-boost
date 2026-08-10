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

func newInterviewServer(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
}

const hintResponse = `{"detected_question_type":"Behavioral","instant_hints":["Start with impact"],"star_framework":{"situation":"S"},"suggested_metrics":[]}`

func TestInterviewCopilotHint_ProxiesToPython(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/interview/copilot-hint" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, hintResponse)
	})
	defer srv.Close()

	server := newInterviewServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/interview/copilot-hint",
		[]byte(`{"interviewer_transcript":"Describe a project"}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Behavioral") {
		t.Errorf("expected passthrough, got %s", w.Body.String())
	}
}

func TestInterviewCopilotHint_AliasRouteAlsoProxies(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, hintResponse)
	})
	defer srv.Close()

	server := newInterviewServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/interview/copilot-hint",
		[]byte(`{"interviewer_transcript":"x"}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestInterviewVoiceFeedback_ProxiesToPython(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/interview/voice-feedback" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"wpm":140,"wpm_status":"good","filler_word_count":1,"filler_words_found":{},"star_breakdown":{},"coaching_tips":[]}`)
	})
	defer srv.Close()

	server := newInterviewServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/interview/voice-feedback",
		[]byte(`{"transcript":"I built a service","duration_seconds":30}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"wpm":140`) {
		t.Errorf("expected passthrough, got %s", w.Body.String())
	}
}

func TestInterviewCopilotStream_PassesEventsThrough(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/interview/copilot/stream" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "data: {\"type\":\"question_type\",\"value\":\"Behavioral\"}\n\ndata: {\"type\":\"done\"}\n\n")
	})
	defer srv.Close()

	server := newInterviewServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/interview/copilot/stream",
		[]byte(`{"interviewer_transcript":"x"}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("expected text/event-stream, got %q", w.Header().Get("Content-Type"))
	}
	if !strings.Contains(w.Body.String(), "question_type") || !strings.Contains(w.Body.String(), "done") {
		t.Errorf("expected events forwarded, got %s", w.Body.String())
	}
}

func TestInterviewCopilotStream_ForwardsUpstream503(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, `{"error":"ai_service_unavailable"}`)
	})
	defer srv.Close()

	server := newInterviewServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/interview/copilot/stream",
		[]byte(`{"interviewer_transcript":"x"}`)))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", w.Code, w.Body.String())
	}
}
