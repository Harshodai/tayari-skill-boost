package api

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"
)

func computerEventsVerifiedRequest(method, target, runID string) *http.Request {
	userID := uuid.New()
	tenantID := uuid.New()
	user := &models.User{ID: userID, Email: "computer-test@example.com"}
	ctx := auth.WithUserContext(context.Background(), user)
	ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{Subject: userID, TenantID: tenantID, Roles: []string{"member"}})
	ctx = contextWithTenant(ctx, &models.Tenant{ID: tenantID})
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("runId", runID)
	ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
	return httptest.NewRequest(method, target, nil).WithContext(ctx)
}

func TestComputerEvents_RejectsWithoutVerifiedContext(t *testing.T) {
	srv := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/computer/runs/12345678-1234-1234-1234-123456789012/events?after=0", nil)
	rec := httptest.NewRecorder()
	srv.handleComputerGETPathSuffix("/api/v1/computer/runs/", "/events")(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403, got %d (body=%s)", rec.Code, rec.Body.String())
	}
}

func TestComputerEvents_ForwardsAfterCursor(t *testing.T) {
	runID := uuid.New().String()
	var gotPath, gotAfter, gotUser, gotTenant string
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAfter = r.URL.Query().Get("after")
		gotUser = r.Header.Get("X-User-Id")
		gotTenant = r.Header.Get("X-Tenant-Id")
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"events":[],"next_after":7}`)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	req := computerEventsVerifiedRequest(http.MethodGet, "/api/v1/computer/runs/"+runID+"/events?after=7", runID)
	rec := httptest.NewRecorder()
	server.handleComputerGETPathSuffix("/api/v1/computer/runs/", "/events")(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (body=%s)", rec.Code, rec.Body.String())
	}
	// ponytail: RawQuery forwarding is the replay contract — ?after= must reach Python verbatim
	if gotAfter != "7" {
		t.Fatalf("upstream after=%q want %q (path=%s)", gotAfter, "7", gotPath)
	}
	if !strings.HasSuffix(gotPath, "/events") {
		t.Fatalf("upstream path=%q want suffix /events", gotPath)
	}
	if gotUser == "" || gotTenant == "" {
		t.Fatalf("verified headers missing upstream (user=%q tenant=%q)", gotUser, gotTenant)
	}
	if !strings.Contains(rec.Body.String(), "next_after") {
		t.Fatalf("expected cursor passthrough, got %s", rec.Body.String())
	}
}

func TestComputerEvents_ForwardsOpaqueId(t *testing.T) {
	var gotPath string
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"events":[],"next_after":1}`)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	req := computerEventsVerifiedRequest(http.MethodGet, "/api/v1/computer/runs/r1/events?after=0", "r1")
	rec := httptest.NewRecorder()
	server.handleComputerGETPathSuffix("/api/v1/computer/runs/", "/events")(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (body=%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(gotPath, "r1") {
		t.Fatalf("upstream path=%q want opaque id r1 forwarded", gotPath)
	}
}

func TestComputerEvents_BothPrefixesRegistered(t *testing.T) {
	routes := collectRoutes(t)
	for _, key := range []string{
		"GET /api/v1/computer/runs/{runId}/events",
		"GET /api/computer/runs/{runId}/events",
		"GET /api/v1/computer/run/{runId}/events",
		"GET /api/computer/run/{runId}/events",
	} {
		if !routes[key] {
			t.Fatalf("missing route %s", key)
		}
	}
}
