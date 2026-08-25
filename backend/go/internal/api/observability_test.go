package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/observability"
)

func TestMetricsBillingEventsAreBoundedAndAggregateOnly(t *testing.T) {
	metrics := observability.NewMetrics()
	metrics.RecordBillingEvent("checkout_attempt")
	metrics.RecordBillingEvent("credit_debit")
	metrics.RecordBillingEvent("user-123")

	snapshot := metrics.Snapshot()
	counters, ok := snapshot["counters"].(map[string]any)
	if !ok {
		t.Fatalf("expected counters map, got %#v", snapshot["counters"])
	}
	events, ok := counters["billing_events"].(map[string]uint64)
	if !ok {
		t.Fatalf("expected billing event map, got %#v", counters["billing_events"])
	}
	if events["checkout_attempt"] != 1 || events["credit_debit"] != 1 || len(events) != 2 {
		t.Fatalf("unexpected bounded billing events: %#v", events)
	}
}

func TestMetricsHandlerRequiresInternalToken(t *testing.T) {
	srv := newSmokeServer(t)
	srv.Config.MetricsToken = "metrics-test-token"
	srv.metrics = observability.NewMetrics()
	srv.metrics.ObserveRequest(http.MethodGet, "/healthz", http.StatusOK, 0)

	withoutToken := httptest.NewRecorder()
	srv.Router.ServeHTTP(withoutToken, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if withoutToken.Code != http.StatusUnauthorized {
		t.Fatalf("without token: want 401, got %d", withoutToken.Code)
	}

	withToken := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	withToken.Header.Set("X-Internal-Token", "metrics-test-token")
	withTokenRecorder := httptest.NewRecorder()
	srv.Router.ServeHTTP(withTokenRecorder, withToken)
	if withTokenRecorder.Code != http.StatusOK {
		t.Fatalf("with token: want 200, got %d (body=%s)", withTokenRecorder.Code, withTokenRecorder.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(withTokenRecorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("metrics body is not JSON: %v", err)
	}
	counters, ok := body["counters"].(map[string]any)
	if !ok {
		t.Fatalf("metrics body has no counters object: %#v", body)
	}
	if counters["requests_total"] == nil {
		t.Fatalf("metrics body has no requests_total: %#v", counters)
	}
}

func TestRequestIDIsEchoedOrGenerated(t *testing.T) {
	srv := newSmokeServer(t)

	known := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	known.Header.Set("X-Request-ID", "trace-known")
	knownRecorder := httptest.NewRecorder()
	srv.Router.ServeHTTP(knownRecorder, known)
	if got := knownRecorder.Header().Get("X-Request-ID"); got != "trace-known" {
		t.Fatalf("known request id=%q, want trace-known", got)
	}

	generated := httptest.NewRecorder()
	srv.Router.ServeHTTP(generated, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if generated.Header().Get("X-Request-ID") == "" {
		t.Fatal("missing request id for request without X-Request-ID")
	}
}

func TestMetricsHandlerFailsClosedWithoutConfiguredToken(t *testing.T) {
	srv := NewServer(&hermesMockAuth{}, &config.Config{}, nil)
	response := httptest.NewRecorder()
	srv.Router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("missing config: want 503, got %d", response.Code)
	}
}
