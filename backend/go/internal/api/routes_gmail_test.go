package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGmailStatus_NotConfigured(t *testing.T) {
	server := newHermesServer(t, "")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/gmail/status", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["enabled"] != false {
		t.Fatalf("expected enabled=false, got %v", resp["enabled"])
	}
}

func TestGmailWebhook_ProcessesPayload(t *testing.T) {
	server := newHermesServer(t, "")

	dataJSON, _ := json.Marshal(map[string]interface{}{
		"emailAddress": "test@example.com",
		"historyId":    12345,
	})
	encodedData := base64.StdEncoding.EncodeToString(dataJSON)

	payload, _ := json.Marshal(map[string]interface{}{
		"message": map[string]interface{}{
			"data":      encodedData,
			"messageId": "msg-123",
		},
	})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/v1/gmail/webhook", bytes.NewReader(payload))
	r.Header.Set("Content-Type", "application/json")
	server.Router.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "processing" {
		t.Fatalf("expected status=processing, got %v", resp["status"])
	}
}
