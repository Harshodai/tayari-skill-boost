package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

// knownAsymmetric lists routes that are intentionally registered under only
// one prefix (v1-only or archive-only). Each key is "METHOD PATTERN" matching
// the prefix that actually exists. The parity check skips these so the test
// locks in parity for every other route while documenting deliberate
// asymmetries here.
var knownAsymmetric = map[string]bool{
	"GET /api/v1/analyze/history":                  true,
	"DELETE /api/v1/agents/{name}":                 true,
	"GET /api/v1/advisor/cohorts":                  true,
	"GET /api/v1/advisor/students":                 true,
	"GET /api/v1/agents":                           true,
	"GET /api/v1/agents/tasks":                     true,
	"GET /api/v1/agents/tasks/{task_id}":           true,
	"GET /api/v1/agents/tasks/{task_id}/events":    true,
	"GET /api/v1/agents/{agent_id}/tasks":          true,
	"GET /api/v1/analytics/bandit-stats":           true,
	"GET /api/v1/analytics/funnel":                 true,
	"GET /api/v1/approvals":                        true,
	"GET /api/v1/agent/config":                     true,
	"GET /api/v1/hermes/config":                    true,
	"GET /api/v1/resumes/{id}/variants":            true,
	"POST /api/v1/advisor/cohorts":                 true,
	"POST /api/v1/agents":                          true,
	"POST /api/v1/agents/{agent_id}/tasks":         true,
	"POST /api/v1/push/register":                   true,
	"POST /api/v1/push/send":                       true,
	"POST /api/v1/resumes/{id}/variants":           true,
	"PUT /api/v1/agents/{name}/instructions":       true,
	"PUT /api/v1/approvals/{approval_id}":          true,
}

// collectRoutes builds the real app router and walks it, returning the set of
// "METHOD PATTERN" strings. chi.Walk traverses mounted sub-routers and inline
// group registrations, so this sees every route the app actually serves.
func collectRoutes(t *testing.T) map[string]bool {
	t.Helper()
	srv := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})
	routes := map[string]bool{}
	if err := chi.Walk(srv.Router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		routes[method+" "+route] = true
		return nil
	}); err != nil {
		t.Fatalf("chi.Walk failed: %v", err)
	}
	return routes
}

// counterpart swaps the /api/ and /api/v1/ prefixes on a pattern.
func counterpart(method, pattern string) (string, bool) {
	switch {
	case strings.HasPrefix(pattern, "/api/v1/"):
		return method + " /api/" + strings.TrimPrefix(pattern, "/api/v1/"), true
	case strings.HasPrefix(pattern, "/api/"):
		return method + " /api/v1/" + strings.TrimPrefix(pattern, "/api/"), true
	default:
		return "", false
	}
}

func TestRouteParity_BidirectionalAliases(t *testing.T) {
	routes := collectRoutes(t)

	var missing []string
	for key := range routes {
		parts := strings.SplitN(key, " ", 2)
		method, pattern := parts[0], parts[1]
		if knownAsymmetric[key] {
			continue
		}
		want, ok := counterpart(method, pattern)
		if !ok {
			continue
		}
		if !routes[want] {
			missing = append(missing, fmt.Sprintf("%s -> missing %s", key, want))
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		t.Fatalf("route parity drift (%d missing counterparts):\n  %s\n"+
			"if asymmetry is intentional, add the existing-side route to knownAsymmetric in router_parity_test.go",
			len(missing), strings.Join(missing, "\n  "))
	}
}

func TestRouteParity_KnownAsymmetricStillExists(t *testing.T) {
	routes := collectRoutes(t)
	var stale []string
	for key := range knownAsymmetric {
		if !routes[key] {
			stale = append(stale, key)
		}
	}
	if len(stale) > 0 {
		sort.Strings(stale)
		t.Fatalf("knownAsymmetric lists routes that no longer exist (remove their entries):\n  %s",
			strings.Join(stale, "\n  "))
	}
}

func TestRouter_RouteCount(t *testing.T) {
	routes := collectRoutes(t)
	if len(routes) < 20 {
		t.Errorf("Expected at least 20 routes registered, got %d", len(routes))
	}
}
