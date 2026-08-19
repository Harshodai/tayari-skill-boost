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

func TestRedactEmail(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"user@example.com", "u***@example.com"},
		{"jane.doe@sub.domain.org", "j***@sub.domain.org"},
		{"a@b.co", "a***@b.co"},
		{"not-an-email", "***"},
		{"", "***"},
		{"a@b@c.com", "***"},
		{"@example.com", "***"},
		{"user@", "***"},
		{"us\ter@example.com", "***"},
		{"us er@example.com", "***"},
		{"user@exa\tmple.com", "***"},
	}
	for _, c := range cases {
		if got := redactEmail(c.in); got != c.want {
			t.Errorf("redactEmail(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeGmailSyncRequest(t *testing.T) {
	query, maxResults, err := normalizeGmailSyncRequest(gmailSyncRequest{})
	if err != nil {
		t.Fatalf("default request should be valid: %v", err)
	}
	if query != defaultGmailSearchQuery || maxResults != 20 {
		t.Fatalf("unexpected defaults: query=%q max=%d", query, maxResults)
	}

	query, maxResults, err = normalizeGmailSyncRequest(gmailSyncRequest{
		Query:      "from:recruiting@example.com",
		After:      "2026-01-01",
		Before:     "2026-02-01",
		MaxResults: 5,
	})
	if err != nil {
		t.Fatalf("bounded request should be valid: %v", err)
	}
	if query != "from:recruiting@example.com after:2026-01-01 before:2026-02-01" || maxResults != 5 {
		t.Fatalf("unexpected normalized request: query=%q max=%d", query, maxResults)
	}

	invalid := []gmailSyncRequest{
		{Query: "in:anywhere"},
		{After: "2026-02-30"},
		{After: "2026-02-01", Before: "2026-01-01"},
		{After: "2026-01-01", Before: "2026-04-15"},
		{MaxResults: maxGmailSyncResults + 1},
	}
	for _, request := range invalid {
		if _, _, err := normalizeGmailSyncRequest(request); err == nil {
			t.Fatalf("expected request to be rejected: %+v", request)
		}
	}
}

func TestGmailWebhook_ProcessesPayload(t *testing.T) {
	server := newHermesServer(t, "")
	t.Setenv("GMAIL_PUBSUB_VERIFICATION_TOKEN", "pubsub-test-token")

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
	r.Header.Set("X-Internal-Token", "pubsub-test-token")
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

// TestGmailWebhook_RejectsUnverifiedPush asserts an anonymous caller cannot
// trigger a sync of somebody else's inbox.
func TestGmailWebhook_RejectsUnverifiedPush(t *testing.T) {
	server := newHermesServer(t, "")
	t.Setenv("GMAIL_PUBSUB_VERIFICATION_TOKEN", "pubsub-test-token")

	payload, _ := json.Marshal(map[string]interface{}{
		"message": map[string]interface{}{"data": "", "messageId": "msg-999"},
	})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/v1/gmail/webhook", bytes.NewReader(payload))
	r.Header.Set("Content-Type", "application/json")
	server.Router.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unverified push, got %d", w.Code)
	}
}
