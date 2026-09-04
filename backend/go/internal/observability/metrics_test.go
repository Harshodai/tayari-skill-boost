package observability

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewMetrics_SnapshotEmpty(t *testing.T) {
	m := NewMetrics()
	snap := m.Snapshot()
	if snap["service"] != "go-backend" {
		t.Fatalf("want go-backend, got %v", snap["service"])
	}
	counters, ok := snap["counters"].(map[string]any)
	if !ok {
		t.Fatal("counters missing")
	}
	if counters["requests_total"] != uint64(0) {
		t.Fatalf("want 0 requests, got %v", counters["requests_total"])
	}
}

func TestObserveRequest(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		route      string
		status     int
		wantMethod string
		wantClass  string
		wantErr    uint64
	}{
		{"ok get", "get", "/api", 200, "GET", "2xx", 0},
		{"empty method unknown", "", "/api", 200, "UNKNOWN", "2xx", 0},
		{"empty route unmatched", "POST", "", 404, "POST", "4xx", 0},
		{"server error counts", "GET", "/api", 500, "GET", "5xx", 1},
		{"lowercase normalized", "post", "/x", 201, "POST", "2xx", 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := NewMetrics()
			m.ObserveRequest(tc.method, tc.route, tc.status, time.Millisecond)
			snap := m.Snapshot()
			byMethod := snap["requests_by_method"].(map[string]uint64)
			if byMethod[tc.wantMethod] != 1 {
				t.Fatalf("want 1 for %s, got %v", tc.wantMethod, byMethod)
			}
			byStatus := snap["requests_by_status_class"].(map[string]uint64)
			if byStatus[tc.wantClass] != 1 {
				t.Fatalf("want 1 for %s, got %v", tc.wantClass, byStatus)
			}
			counters := snap["counters"].(map[string]any)
			if counters["request_errors_total"] != tc.wantErr {
				t.Fatalf("want errors %d, got %v", tc.wantErr, counters["request_errors_total"])
			}
		})
	}
}

func TestRecordProviderAndBudget(t *testing.T) {
	m := NewMetrics()
	m.RecordProviderError("openai")
	m.RecordProviderError("  ")
	m.RecordProviderError(strings.Repeat("p", 200))
	m.RecordBudgetExceeded()
	m.RecordBudgetExceeded()
	snap := m.Snapshot()
	errs := snap["provider_errors_by_name"].(map[string]uint64)
	if errs["openai"] != 1 || errs["unknown"] != 1 {
		t.Fatalf("provider errors wrong: %v", errs)
	}
	for k := range errs {
		if len(k) > 96 {
			t.Fatalf("provider label not truncated: %d", len(k))
		}
	}
	if snap["counters"].(map[string]any)["budget_exceeded_total"] != uint64(2) {
		t.Fatalf("budget wrong: %v", snap["counters"])
	}
}

func TestRecordBillingEvent(t *testing.T) {
	allowed := []string{"checkout_attempt", "checkout_created", "checkout_failed", "credit_purchase_fulfilled", "credit_debit", "credit_refund"}
	m := NewMetrics()
	for _, e := range allowed {
		m.RecordBillingEvent(e)
	}
	m.RecordBillingEvent("arbitrary_user_label")
	m.RecordBillingEvent("")
	snap := m.Snapshot()
	events := snap["counters"].(map[string]any)["billing_events"].(map[string]uint64)
	if len(events) != len(allowed) {
		t.Fatalf("want %d events, got %v", len(allowed), events)
	}
	for _, e := range allowed {
		if events[e] != 1 {
			t.Fatalf("want 1 for %s, got %v", e, events)
		}
	}
}

func TestSetQueueAge(t *testing.T) {
	m := NewMetrics()
	m.SetQueueAgeSeconds(-5)
	snap := m.Snapshot()
	if snap["counters"].(map[string]any)["queue_age_seconds"] != float64(0) {
		t.Fatalf("negative clamped: %v", snap["counters"])
	}
	m.SetQueueAgeSeconds(12.5)
	snap = m.Snapshot()
	if snap["counters"].(map[string]any)["queue_age_seconds"] != float64(12.5) {
		t.Fatalf("age wrong: %v", snap["counters"])
	}
}

func TestNilReceiverSafe(t *testing.T) {
	var m *Metrics
	m.ObserveRequest("GET", "/", 200, 0)
	m.RecordProviderError("x")
	m.RecordBudgetExceeded()
	m.RecordBillingEvent("credit_debit")
	m.SetQueueAgeSeconds(1)
	if snap := m.Snapshot(); snap["service"] != "go-backend" {
		t.Fatalf("nil snapshot wrong: %v", snap)
	}
}

func TestHandler_Auth(t *testing.T) {
	tests := []struct {
		name      string
		token     string
		header    string
		wantCode  int
		wantValid bool
	}{
		{"unconfigured 503", "", "", http.StatusServiceUnavailable, false},
		{"missing token 401", "secret", "", http.StatusUnauthorized, false},
		{"wrong token 401", "secret", "nope", http.StatusUnauthorized, false},
		{"correct 200", "secret", "secret", http.StatusOK, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := NewMetrics()
			h := m.Handler(tc.token)
			req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
			if tc.header != "" {
				req.Header.Set("X-Internal-Token", tc.header)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)
			if w.Code != tc.wantCode {
				t.Fatalf("want %d, got %d body=%s", tc.wantCode, w.Code, w.Body.String())
			}
			if tc.wantValid {
				var decoded map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &decoded); err != nil {
					t.Fatalf("invalid json: %v", err)
				}
				if decoded["service"] != "go-backend" {
					t.Fatalf("wrong service: %v", decoded)
				}
			}
		})
	}
}
