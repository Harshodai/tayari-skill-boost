package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tayari-backend/internal/config"
)

func extensionAuthResponse(t *testing.T, server *Server, request *http.Request) map[string]string {
	t.Helper()
	recorder := httptest.NewRecorder()
	server.handleExtensionAuthConfig(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response map[string]string
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return response
}

func TestExtensionAuthConfig_UsesBrowserReachableLocalSupabaseURL(t *testing.T) {
	server := &Server{Config: &config.Config{
		SupabaseURL:       "http://kong:8000",
		SupabasePublicURL: "http://127.0.0.1:8010",
		SupabaseKey:       "public",
	}}
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8085/api/v1/auth/extension/config", nil)
	response := extensionAuthResponse(t, server, request)
	if response["supabase_url"] != "http://127.0.0.1:8010" {
		t.Fatalf("expected browser-reachable Supabase URL, got %q", response["supabase_url"])
	}
	if response["api_url"] != "http://127.0.0.1:8085/api" {
		t.Fatalf("expected loopback HTTP API URL, got %q", response["api_url"])
	}
}

func TestExtensionAuthConfig_PreservesForwardedHTTPSProductionOrigin(t *testing.T) {
	server := &Server{Config: &config.Config{
		SupabaseURL:       "https://internal.supabase.example",
		SupabasePublicURL: "https://supabase.example",
		SupabaseKey:       "public",
	}}
	request := httptest.NewRequest(http.MethodGet, "https://gateway.example/api/v1/auth/extension/config", nil)
	request.Header.Set("X-Forwarded-Proto", "https")
	request.Header.Set("X-Forwarded-Host", "app.example")
	response := extensionAuthResponse(t, server, request)
	if response["supabase_url"] != "https://supabase.example" {
		t.Fatalf("expected configured public Supabase URL, got %q", response["supabase_url"])
	}
	if response["api_url"] != "https://app.example/api" {
		t.Fatalf("expected forwarded HTTPS API URL, got %q", response["api_url"])
	}
}

func TestExtensionAuthConfig_FailsClosedWithoutSupabaseCredentials(t *testing.T) {
	server := &Server{Config: &config.Config{}}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/auth/extension/config", nil)
	server.handleExtensionAuthConfig(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
