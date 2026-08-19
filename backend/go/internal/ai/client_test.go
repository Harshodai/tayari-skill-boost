package ai

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPostJSONWithHeadersAcceptsCreatedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"success":true,"id":"run-1"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.PostJSONWithHeaders("/capture", map[string]string{"ok": "true"}, nil)
	if err != nil {
		t.Fatalf("expected 201 JSON to be accepted, got error: %v", err)
	}
	if result["id"] != "run-1" {
		t.Fatalf("unexpected response: %#v", result)
	}
}
