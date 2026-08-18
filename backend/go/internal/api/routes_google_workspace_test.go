package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGoogleCalendarStatus_NotConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("GOOGLE_CLIENT_SECRET", "")
	server := newHermesServer(t, "")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/google/calendar/status", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response["enabled"] != false || response["read_only"] != true {
		t.Fatalf("unexpected Calendar status: %#v", response)
	}
}

func TestGoogleDriveStatus_NotConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("GOOGLE_CLIENT_SECRET", "")
	server := newHermesServer(t, "")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/google/drive/status", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response["enabled"] != false || response["read_only"] != true {
		t.Fatalf("unexpected Drive status: %#v", response)
	}
}

func TestGoogleWorkspaceLogin_NotConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("GOOGLE_CLIENT_SECRET", "")
	server := newHermesServer(t, "")
	for _, path := range []string{"/api/v1/google/calendar/login", "/api/v1/google/drive/login"} {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, authReq(http.MethodGet, path, nil))
		if w.Code != http.StatusNotImplemented {
			t.Fatalf("%s: expected 501, got %d: %s", path, w.Code, w.Body.String())
		}
	}
}
