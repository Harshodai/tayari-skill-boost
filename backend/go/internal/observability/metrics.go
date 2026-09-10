package observability

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Metrics is a small process-local registry for release-critical operational
// signals. The registry deliberately avoids unbounded URL/user labels: routes
// should be chi route patterns, and callers provide only bounded provider names.
type Metrics struct {
	mu sync.RWMutex

	requestTotal      uint64
	requestErrors     uint64
	requestByMethod   map[string]uint64
	requestByStatus   map[string]uint64
	providerErrors    map[string]uint64
	budgetExceeded    uint64
	billingEvents     map[string]uint64
	queueAgeSeconds   float64
	lastQueueRecorded time.Time
}

func NewMetrics() *Metrics {
	return &Metrics{
		requestByMethod: make(map[string]uint64),
		requestByStatus: make(map[string]uint64),
		providerErrors:  make(map[string]uint64),
		billingEvents:   make(map[string]uint64),
	}
}

func (m *Metrics) ObserveRequest(method, route string, status int, _ time.Duration) {
	if m == nil {
		return
	}
	method = strings.ToUpper(strings.TrimSpace(method))
	if method == "" {
		method = "UNKNOWN"
	}
	if route == "" {
		route = "unmatched"
	}
	statusClass := strconv.Itoa(status/100) + "xx"

	m.mu.Lock()
	defer m.mu.Unlock()
	m.requestTotal++
	m.requestByMethod[method]++
	m.requestByStatus[statusClass]++
	if status >= http.StatusInternalServerError {
		m.requestErrors++
	}
}

func (m *Metrics) RecordProviderError(provider string) {
	if m == nil {
		return
	}
	provider = strings.TrimSpace(provider)
	if provider == "" {
		provider = "unknown"
	}
	if len(provider) > 96 {
		provider = provider[:96]
	}
	m.mu.Lock()
	m.providerErrors[provider]++
	m.mu.Unlock()
}

func (m *Metrics) RecordBudgetExceeded() {
	if m == nil {
		return
	}
	m.mu.Lock()
	m.budgetExceeded++
	m.mu.Unlock()
}

// RecordBillingEvent records only a bounded, aggregate monetization lifecycle
// event. It deliberately rejects arbitrary labels and never accepts user, price,
// payment, or provider identifiers.
func (m *Metrics) RecordBillingEvent(event string) {
	if m == nil {
		return
	}
	allowed := map[string]struct{}{
		"checkout_attempt": {}, "checkout_created": {}, "checkout_failed": {},
		"credit_purchase_fulfilled": {}, "credit_debit": {}, "credit_refund": {},
	}
	if _, ok := allowed[event]; !ok {
		return
	}
	m.mu.Lock()
	m.billingEvents[event]++
	m.mu.Unlock()
}

func (m *Metrics) SetQueueAgeSeconds(age float64) {
	if m == nil {
		return
	}
	if age < 0 {
		age = 0
	}
	m.mu.Lock()
	m.queueAgeSeconds = age
	m.lastQueueRecorded = time.Now().UTC()
	m.mu.Unlock()
}

func (m *Metrics) Snapshot() map[string]any {
	if m == nil {
		return map[string]any{"service": "go-backend", "counters": map[string]any{}}
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	byMethod := make(map[string]uint64, len(m.requestByMethod))
	for key, value := range m.requestByMethod {
		byMethod[key] = value
	}
	byStatus := make(map[string]uint64, len(m.requestByStatus))
	for key, value := range m.requestByStatus {
		byStatus[key] = value
	}
	providerErrors := make(map[string]uint64, len(m.providerErrors))
	for key, value := range m.providerErrors {
		providerErrors[key] = value
	}
	billingEvents := make(map[string]uint64, len(m.billingEvents))
	for key, value := range m.billingEvents {
		billingEvents[key] = value
	}

	counters := map[string]any{
		"requests_total":        m.requestTotal,
		"request_errors_total":  m.requestErrors,
		"llm_errors_total":      uint64(0),
		"budget_exceeded_total": m.budgetExceeded,
		"queue_age_seconds":     m.queueAgeSeconds,
		"billing_events":        billingEvents,
	}
	return map[string]any{
		"service":                    "go-backend",
		"counters":                   counters,
		"requests_by_method":         byMethod,
		"requests_by_status_class":   byStatus,
		"provider_errors_by_name":    providerErrors,
		"queue_age_last_recorded_at": m.lastQueueRecorded,
	}
}

// PrometheusHandler outputs metrics in Prometheus exposition text format.
// It uses the same X-Internal-Token auth contract as Handler.
func (m *Metrics) PrometheusHandler(expectedToken string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if expectedToken == "" {
			http.Error(w, "metrics authentication is not configured", http.StatusServiceUnavailable)
			return
		}
		provided := r.Header.Get("X-Internal-Token")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(expectedToken)) != 1 {
			http.Error(w, "metrics authentication required", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")

		m.mu.RLock()
		defer m.mu.RUnlock()

		var b strings.Builder

		// tayari_requests_total
		fmt.Fprintf(&b, "# HELP tayari_requests_total Total HTTP requests\n")
		fmt.Fprintf(&b, "# TYPE tayari_requests_total counter\n")
		fmt.Fprintf(&b, "tayari_requests_total %d\n", m.requestTotal)

		// tayari_request_errors_total
		fmt.Fprintf(&b, "# HELP tayari_request_errors_total Total 5xx HTTP requests\n")
		fmt.Fprintf(&b, "# TYPE tayari_request_errors_total counter\n")
		fmt.Fprintf(&b, "tayari_request_errors_total %d\n", m.requestErrors)

		// tayari_budget_exceeded_total
		fmt.Fprintf(&b, "# HELP tayari_budget_exceeded_total Total budget exceeded events\n")
		fmt.Fprintf(&b, "# TYPE tayari_budget_exceeded_total counter\n")
		fmt.Fprintf(&b, "tayari_budget_exceeded_total %d\n", m.budgetExceeded)

		// tayari_queue_age_seconds
		fmt.Fprintf(&b, "# HELP tayari_queue_age_seconds Age of oldest pending queue item in seconds\n")
		fmt.Fprintf(&b, "# TYPE tayari_queue_age_seconds gauge\n")
		fmt.Fprintf(&b, "tayari_queue_age_seconds %v\n", m.queueAgeSeconds)

		// tayari_requests_by_method
		fmt.Fprintf(&b, "# HELP tayari_requests_by_method Requests grouped by HTTP method\n")
		fmt.Fprintf(&b, "# TYPE tayari_requests_by_method counter\n")
		methods := sortedKeys(m.requestByMethod)
		for _, method := range methods {
			fmt.Fprintf(&b, "tayari_requests_by_method{method=%q} %d\n", method, m.requestByMethod[method])
		}

		// tayari_requests_by_status_class
		fmt.Fprintf(&b, "# HELP tayari_requests_by_status_class Requests grouped by status class\n")
		fmt.Fprintf(&b, "# TYPE tayari_requests_by_status_class counter\n")
		statuses := sortedKeys(m.requestByStatus)
		for _, status := range statuses {
			fmt.Fprintf(&b, "tayari_requests_by_status_class{status=%q} %d\n", status, m.requestByStatus[status])
		}

		// tayari_provider_errors_total
		fmt.Fprintf(&b, "# HELP tayari_provider_errors_total Provider errors by name\n")
		fmt.Fprintf(&b, "# TYPE tayari_provider_errors_total counter\n")
		providers := sortedKeys(m.providerErrors)
		for _, provider := range providers {
			fmt.Fprintf(&b, "tayari_provider_errors_total{provider=%q} %d\n", provider, m.providerErrors[provider])
		}

		// tayari_billing_events_total
		fmt.Fprintf(&b, "# HELP tayari_billing_events_total Billing lifecycle events\n")
		fmt.Fprintf(&b, "# TYPE tayari_billing_events_total counter\n")
		events := sortedKeys(m.billingEvents)
		for _, event := range events {
			fmt.Fprintf(&b, "tayari_billing_events_total{event=%q} %d\n", event, m.billingEvents[event])
		}

		w.Write([]byte(b.String()))
	})
}

func sortedKeys(m map[string]uint64) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// Handler protects the telemetry endpoint with the same X-Internal-Token
// contract used by the Go-to-Python gateway. A missing configured token fails
// closed instead of silently turning metrics into a public information leak.
func (m *Metrics) Handler(expectedToken string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if expectedToken == "" {
			http.Error(w, "metrics authentication is not configured", http.StatusServiceUnavailable)
			return
		}
		provided := r.Header.Get("X-Internal-Token")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(expectedToken)) != 1 {
			http.Error(w, "metrics authentication required", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(m.Snapshot())
	})
}
