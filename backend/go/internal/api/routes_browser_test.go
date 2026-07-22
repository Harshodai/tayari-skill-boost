package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBrowserAutomation_ProxiesToPython(t *testing.T) {
	fakePython := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/browser/automation" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("failed to decode body: %v", err)
		}
		if req["instruction"] != "Find latest news" {
			t.Errorf("unexpected instruction: %v", req["instruction"])
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"success":true,"summary":"Found 3 top AI stories"}`)
	})
	defer fakePython.Close()

	server := newHermesServer(t, fakePython.URL)
	w := httptest.NewRecorder()
	reqBody := []byte(`{"instruction":"Find latest news"}`)
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/browser/automation", reqBody))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["success"] != true {
		t.Fatalf("expected success true, got %v", resp["success"])
	}
}
