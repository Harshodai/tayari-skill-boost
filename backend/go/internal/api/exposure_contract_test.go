package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"tayari-backend/internal/config"
)

func TestExposureRegistryAnonymousRoutesAreRegistered(t *testing.T) {
	routes := collectRoutes(t)
	anonymous := []string{
		"GET /health",
		"GET /healthz",
		"GET /readyz",
		"GET /api/health",
		"GET /api/health/detailed",
		"GET /api/v1/health",
		"GET /api/v1/health/detailed",
		"POST /api/auth/register",
		"POST /api/v1/auth/register",
		"POST /api/auth/login",
		"POST /api/v1/auth/login",
		"POST /api/auth/rate-limit",
		"POST /api/v1/auth/rate-limit",
		"POST /api/auth/forgot-password",
		"POST /api/v1/auth/forgot-password",
		"POST /api/auth/reset-password",
		"POST /api/v1/auth/reset-password",
		"GET /api/auth/{provider}",
		"GET /api/v1/auth/{provider}",
		"GET /api/auth/{provider}/callback",
		"GET /api/v1/auth/{provider}/callback",
		"GET /api/v1/tenants/branding",
		"POST /api/v1/analytics/performance",
		"POST /api/public/analyze-text",
		"POST /api/v1/public/analyze-text",
		"POST /api/security/check-breached-password",
		"POST /api/v1/security/check-breached-password",
		"GET /api/oauth/gmail/callback",
		"GET /api/v1/oauth/gmail/callback",
		"POST /api/gmail/webhook",
		"POST /api/v1/gmail/webhook",
		"GET /metrics",
	}
	for _, route := range anonymous {
		if !routes[route] {
			t.Errorf("exposure registry route is not registered: %s", route)
		}
	}
}

func TestExposureRepresentativeProtectedRoutesRejectAnonymous(t *testing.T) {
	srv := newSmokeServer(t)
	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/profile"},
		{http.MethodPost, "/api/v1/resumes"},
		{http.MethodGet, "/api/v1/gmail/status"},
		{http.MethodPost, "/api/v1/public/optimize"},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			response := httptest.NewRecorder()
			srv.Router.ServeHTTP(response, req)
			if response.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous %s %s: want 401, got %d (body=%s)", tc.method, tc.path, response.Code, response.Body.String())
			}
		})
	}
}

func TestExposureMetricsRequiresInternalToken(t *testing.T) {
	srv := NewServer(&hermesMockAuth{}, &config.Config{MetricsToken: "metrics-contract-token"}, nil)
	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	request.Header.Set("X-Internal-Token", "wrong-token")
	response := httptest.NewRecorder()
	srv.Router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("wrong metrics token: want 401, got %d", response.Code)
	}
}
