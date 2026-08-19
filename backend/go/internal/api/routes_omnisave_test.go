package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOmniSaveRoutesRequireAuthentication(t *testing.T) {
	upstreamCalled := false
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		upstreamCalled = true
		w.WriteHeader(http.StatusOK)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/saves/export", nil)
	server.Router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated OmniSave request, got %d", w.Code)
	}
	if upstreamCalled {
		t.Fatal("unauthenticated OmniSave request reached the Python service")
	}
}

func TestOmniSaveCaptureRoutesRequireAuthentication(t *testing.T) {
	upstreamCalled := false
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		upstreamCalled = true
		w.WriteHeader(http.StatusOK)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	paths := []string{
		"/api/v1/saves/capture/runs",
		"/api/v1/saves/capture/runs/00000000-0000-0000-0000-000000000001",
		"/api/v1/saves/capture/runs/00000000-0000-0000-0000-000000000001/items",
	}
	for _, path := range paths {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unauthenticated capture route %s, got %d", path, w.Code)
		}
	}
	if upstreamCalled {
		t.Fatal("unauthenticated capture request reached the Python service")
	}
}

func TestOmniSaveProxyRejectsOversizedBody(t *testing.T) {
	upstreamCalled := false
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		upstreamCalled = true
		w.WriteHeader(http.StatusCreated)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	body := strings.Repeat("x", omniSaveMaxBodyBytes+1)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/saves/import/seed", []byte(body)))

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for oversized OmniSave request, got %d", w.Code)
	}
	if upstreamCalled {
		t.Fatal("oversized OmniSave request reached the Python service")
	}
}
