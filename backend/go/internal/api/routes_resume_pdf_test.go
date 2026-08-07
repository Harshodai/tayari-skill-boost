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

func newResumePdfServer(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
}

func TestResumeGeneratePdf_ProxiesToPythonAndReturns200(t *testing.T) {
	pdfJSON := `{"pdf_base64":"JVBERi0xLjQ="}`
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/api/v1/resumes/generate-pdf" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "resume_text") {
			t.Errorf("expected resume_text forwarded in body, got %s", string(body))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, pdfJSON)
	})
	defer srv.Close()

	server := newResumePdfServer(t, srv.URL)
	body := []byte(`{"resume_text":"Experienced Go engineer","profile_data":{"full_name":"Jane Doe"},"analysis":{"overall_score":72}}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resumes/generate-pdf", body))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp["pdf_base64"] != "JVBERi0xLjQ=" {
		t.Errorf("expected pdf_base64 passthrough, got %s", w.Body.String())
	}
}

func TestResumeGeneratePdf_AliasRouteAlsoProxies(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/resumes/generate-pdf" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"pdf_base64":"JVBERi0xLjQ="}`)
	})
	defer srv.Close()

	server := newResumePdfServer(t, srv.URL)
	body := []byte(`{"resume_text":"Jane","profile_data":{},"analysis":{}}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/resumes/generate-pdf", body))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestResumeGeneratePdf_RejectsOversizedResumeText(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newResumePdfServer(t, srv.URL)
	body := []byte(`{"resume_text":"` + strings.Repeat("a", 50001) + `","profile_data":{},"analysis":{}}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resumes/generate-pdf", body))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for oversized resume_text")
	}
}

func TestResumeGeneratePdf_RejectsOversizedJobDescription(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newResumePdfServer(t, srv.URL)
	body := []byte(`{"resume_text":"Jane","profile_data":{},"analysis":{},"job_description":"` + strings.Repeat("b", 20001) + `"}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resumes/generate-pdf", body))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for oversized job_description")
	}
}

func TestResumeGeneratePdf_ForwardPython500(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, `{"detail":"Resume PDF generation failed"}`)
	})
	defer srv.Close()

	server := newResumePdfServer(t, srv.URL)
	body := []byte(`{"resume_text":"Jane","profile_data":{},"analysis":{}}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resumes/generate-pdf", body))

	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", w.Code, w.Body.String())
	}
}
