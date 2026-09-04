package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStreamSuccessResetsBreaker_GetBlob(t *testing.T) {
	fails := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/fail" {
			fails++
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`err`))
			return
		}
		_, _ = w.Write([]byte(`blob-bytes`))
	}))
	defer server.Close()
	c := NewClient(server.URL)
	for i := 0; i < 2; i++ {
		if _, err := c.GetJSON("/fail"); err == nil {
			t.Fatalf("expected 5xx error on fail call %d", i)
		}
	}
	resp, err := c.GetBlob("/ok", nil)
	if err != nil {
		t.Fatalf("GetBlob success: %v", err)
	}
	resp.Body.Close()
	if _, err := c.GetJSON("/fail"); err == nil {
		t.Fatalf("expected 5xx error after reset")
	}
	if _, err := c.GetJSON("/ok-probe"); IsCircuitOpen(err) {
		t.Fatalf("breaker stayed open after stream success reset: %v", err)
	}
}

func TestStreamSuccessResetsBreaker_PostStream(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/fail" {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`err`))
			return
		}
		_, _ = w.Write([]byte(`stream-bytes`))
	}))
	defer server.Close()
	c := NewClient(server.URL)
	for i := 0; i < 2; i++ {
		if _, err := c.GetJSON("/fail"); err == nil {
			t.Fatalf("expected 5xx error on fail call %d", i)
		}
	}
	resp, err := c.PostStream(context.Background(), "/ok", map[string]string{"a": "b"}, nil)
	if err != nil {
		t.Fatalf("PostStream success: %v", err)
	}
	resp.Body.Close()
	if _, err := c.GetJSON("/fail"); err == nil {
		t.Fatalf("expected 5xx error after reset")
	}
	if _, err := c.GetJSON("/ok-probe"); IsCircuitOpen(err) {
		t.Fatalf("breaker stayed open after PostStream success reset: %v", err)
	}
}

func TestDecodeErrorAfter200DoesNotTripBreaker(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`not-json{{{`))
	}))
	defer server.Close()
	c := NewClient(server.URL)
	for i := 0; i < 5; i++ {
		if _, err := c.GetJSON("/x"); IsCircuitOpen(err) {
			t.Fatalf("decode-after-200 tripped breaker on call %d", i)
		}
	}
}
