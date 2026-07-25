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
//
// ponytail: allowlist instead of a full audit — adding a route to only one
// prefix now requires a one-line entry here, which is cheaper than a silent
// drift and surfaces in review.
var knownAsymmetric = map[string]bool{
	"GET /api/v1/analyze/history": true,
}

// collectRoutes builds the real app router and walks it, returning the set of
// "METHOD PATTERN" strings. chi.Walk traverses mounted sub-routers and inline
// group registrations, so this sees every route the app actually serves.
func collectRoutes(t *testing.T) map[string]bool {
	t.Helper()
	// hermesMockAuth is defined in routes_hermes_test.go (same package); any
	// mock works since Walk only reads the route tree and never invokes auth.
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
			continue // non-/api route (e.g. internal health), out of scope
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

// TestRouteParity_KnownAsymmetricStillExists guards the allowlist itself: if
// someone removes a route that was intentionally asymmetric, the allowlist
// entry becomes stale and should be noticed.
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
