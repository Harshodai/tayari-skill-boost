package ai

import (
	"bytes"
	"io"
	"net/http"
	"testing"
)

type captureTransport struct {
	gotHeaders http.Header
}

func (c *captureTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	c.gotHeaders = req.Header.Clone()
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(`{}`))),
	}, nil
}

func TestPostJSONWithHeaders_SetsRequestID(t *testing.T) {
	client := NewClient("http://example.com")
	ct := &captureTransport{}
	client.SetTransport(ct)
	if _, err := client.PostJSONWithHeaders("/capture", map[string]string{"ok": "true"}, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ct.gotHeaders.Get("X-Request-ID") == "" {
		t.Fatal("missing X-Request-ID on proxied AI call")
	}
}

func TestPostJSONWithHeaders_PreservesCallerRequestID(t *testing.T) {
	client := NewClient("http://example.com")
	ct := &captureTransport{}
	client.SetTransport(ct)
	if _, err := client.PostJSONWithHeaders("/capture", map[string]string{"ok": "true"},
		map[string]string{"X-Request-ID": "trace-caller-1"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := ct.gotHeaders.Get("X-Request-ID"); got != "trace-caller-1" {
		t.Fatalf("caller X-Request-ID overwritten: got %q", got)
	}
}
