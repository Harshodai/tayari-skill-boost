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

func newReferralServer(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
}

const draftResponse = `{"fit_score":88.0,"subject":"Referral ask for Acme","body":"Hi Alice...","rationale":"Former manager"}`

func validDraftPayload() []byte {
	return []byte(`{"contact":{"name":"Alice Chen","relationship":"Worked together at Acme 2019-2022","notes":"Backend team"},"job":{"title":"Senior Backend Engineer","company":"Acme"},"user_context":{"full_name":"Jane Doe","skills":["Go"]},"kind":"referral"}`)
}

func TestReferralDraft_RejectsMissingKind(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newReferralServer(t, srv.URL)
	payload := []byte(`{"contact":{"name":"Alice Chen","relationship":"Worked together at Acme"},"job":{"title":"Engineer"}}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/referral/draft", payload))

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for missing kind")
	}
}

func TestReferralDraft_RejectsUnknownKind(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newReferralServer(t, srv.URL)
	payload := []byte(`{"contact":{"name":"Alice Chen","relationship":"Worked together at Acme"},"job":{"title":"Engineer"},"kind":"spam"}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/referral/draft", payload))

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for unknown kind")
	}
}

func TestReferralDraft_ProxiesToPythonAndReturns200(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/referral/draft" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "Alice Chen") {
			t.Errorf("expected contact forwarded, got %s", string(body))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, draftResponse)
	})
	defer srv.Close()

	server := newReferralServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/referral/draft", validDraftPayload()))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["fit_score"] != 88.0 {
		t.Errorf("expected fit_score passthrough, got %v", resp["fit_score"])
	}
}

func TestReferralDraft_AliasRouteAlsoProxies(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/referral/draft" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, draftResponse)
	})
	defer srv.Close()

	server := newReferralServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/referral/draft", validDraftPayload()))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReferralDraft_RejectsMissingRelationship(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newReferralServer(t, srv.URL)
	payload := []byte(`{"contact":{"name":"Alice Chen","relationship":""},"job":{"title":"Engineer"},"kind":"referral"}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/referral/draft", payload))

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for missing relationship")
	}
}

func TestReferralDraft_RejectsOversizedNotes(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newReferralServer(t, srv.URL)
	payload := []byte(`{"contact":{"name":"Alice","relationship":"Former colleague","notes":"` + strings.Repeat("n", 2001) + `"},"job":{"title":"Engineer"},"kind":"referral"}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/referral/draft", payload))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for oversized notes")
	}
}

func TestReferralDraft_ForwardsPython503(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, `{"error":"ai_service_unavailable"}`)
	})
	defer srv.Close()

	server := newReferralServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/referral/draft", validDraftPayload()))

	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d: %s", w.Code, w.Body.String())
	}
}
