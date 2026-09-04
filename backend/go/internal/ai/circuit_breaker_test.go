package ai

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestCircuitBreakerOpensAfterThreshold(t *testing.T) {
	now := time.Now()
	clock := func() time.Time { return now }
	b := NewCircuitBreaker(3, 30*time.Second, clock)
	for i := 0; i < 2; i++ {
		if !b.BeforeCall() {
			t.Fatalf("call %d blocked before threshold", i)
		}
		b.AfterCall(false)
	}
	if !b.BeforeCall() {
		t.Fatal("third call blocked before recording third failure")
	}
	b.AfterCall(false)
	if b.BeforeCall() {
		t.Fatal("expected open circuit to block calls after 3 failures")
	}
	if !errors.Is(ErrCircuitOpen, ErrCircuitOpen) || !IsCircuitOpen(ErrCircuitOpen) {
		t.Fatal("IsCircuitOpen must match ErrCircuitOpen")
	}
}

func TestCircuitBreakerHalfOpensAfterCooldown(t *testing.T) {
	now := time.Now()
	current := now
	b := NewCircuitBreaker(3, 30*time.Second, func() time.Time { return current })
	for i := 0; i < 3; i++ {
		if !b.BeforeCall() {
			t.Fatalf("call %d blocked while closed", i)
		}
		b.AfterCall(false)
	}
	if b.BeforeCall() {
		t.Fatal("expected open circuit")
	}
	current = now.Add(31 * time.Second)
	if !b.BeforeCall() {
		t.Fatal("expected half-open probe after cooldown")
	}
	b.AfterCall(true)
	if !b.BeforeCall() {
		t.Fatal("expected closed circuit after successful probe")
	}
	b.AfterCall(false)
	if !b.BeforeCall() {
		t.Fatal("single failure must not reopen a closed circuit")
	}
}

func TestCircuitBreakerSuccessResetsCount(t *testing.T) {
	b := NewCircuitBreaker(3, 30*time.Second, nil)
	b.BeforeCall()
	b.AfterCall(false)
	b.BeforeCall()
	b.AfterCall(false)
	b.BeforeCall()
	b.AfterCall(true)
	b.BeforeCall()
	b.AfterCall(false)
	if !b.BeforeCall() {
		t.Fatal("success should reset consecutive failure count")
	}
}

func TestDegradedPayloadShape(t *testing.T) {
	p := DegradedPayload()
	if p["degraded"] != true || p["reason"] != "ai_engine_unavailable" {
		t.Fatalf("unexpected degraded payload: %#v", p)
	}
}

type failRoundTripper struct{ calls *int64 }

func (f failRoundTripper) RoundTrip(_ *http.Request) (*http.Response, error) {
	atomic.AddInt64(f.calls, 1)
	return nil, errors.New("connection refused")
}

func TestClientOpensAfterThreeTransportFailures(t *testing.T) {
	c := NewClient("http://127.0.0.1:9")
	var calls int64
	c.SetTransport(failRoundTripper{calls: &calls})
	for i := 0; i < 3; i++ {
		if _, err := c.GetJSON("/health"); !IsCircuitOpen(err) && err == nil {
			t.Fatalf("call %d: expected transport error, got nil", i)
		}
	}
	if _, err := c.GetJSON("/health"); !IsCircuitOpen(err) {
		t.Fatalf("expected ErrCircuitOpen fast-fail, got: %v", err)
	}
	if got := atomic.LoadInt64(&calls); got != 3 {
		t.Fatalf("open circuit must not dial upstream: got %d calls", got)
	}
}

func TestClientIgnoresClientErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"bad request"}`))
	}))
	defer server.Close()
	c := NewClient(server.URL)
	for i := 0; i < 5; i++ {
		if _, err := c.GetJSON("/x"); IsCircuitOpen(err) {
			t.Fatalf("4xx must not trip the breaker (call %d)", i)
		}
	}
}
