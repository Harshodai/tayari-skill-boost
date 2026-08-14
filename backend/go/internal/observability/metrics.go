package observability

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
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
	queueAgeSeconds   float64
	lastQueueRecorded time.Time
}

func NewMetrics() *Metrics {
	return &Metrics{
		requestByMethod: make(map[string]uint64),
		requestByStatus: make(map[string]uint64),
		providerErrors:  make(map[string]uint64),
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

	counters := map[string]any{
		"requests_total":        m.requestTotal,
		"request_errors_total":  m.requestErrors,
		"llm_errors_total":      uint64(0),
		"budget_exceeded_total": m.budgetExceeded,
		"queue_age_seconds":     m.queueAgeSeconds,
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
