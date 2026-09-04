package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/models"
)

func TestApplicationRuns_RejectsAnonymous(t *testing.T) {
	srv := &Server{}

	t.Run("GET rejects anonymous caller", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/application-runs/123", nil)
		rec := httptest.NewRecorder()
		srv.handleGetApplicationRun(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized, got %d", rec.Code)
		}
	})

	t.Run("POST transition rejects anonymous caller", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/application-runs/123/transition", bytes.NewReader([]byte(`{"new_state":"reviewed"}`)))
		rec := httptest.NewRecorder()
		srv.handleTransitionApplicationRun(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized, got %d", rec.Code)
		}
	})
}

func TestApplicationRuns_EmptyRunID(t *testing.T) {
	srv := &Server{}
	testUser := &models.User{
		ID:    uuid.New(),
		Email: "test-candidate@example.com",
	}

	t.Run("GET empty run ID returns 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/application-runs/", nil)
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		srv.handleGetApplicationRun(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
		}
	})

	t.Run("POST transition empty run ID returns 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/application-runs//transition", bytes.NewReader([]byte(`{"new_state":"reviewed"}`)))
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		srv.handleTransitionApplicationRun(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
		}
	})
}

func TestApplicationRuns_UpstreamUnavailableMapsTo502(t *testing.T) {
	srv := &Server{}
	testUser := &models.User{
		ID:    uuid.New(),
		Email: "test-candidate@example.com",
	}
	validRunID := uuid.New().String()

	t.Run("GET upstream nil client returns 502", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/application-runs/"+validRunID, nil)
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", validRunID)
		ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		srv.handleGetApplicationRun(rec, req)

		if rec.Code != http.StatusBadGateway {
			t.Fatalf("expected 502 Bad Gateway when AI is nil, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("POST transition upstream nil client returns 502", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/application-runs/"+validRunID+"/transition", bytes.NewReader([]byte(`{"new_state":"reviewed"}`)))
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", validRunID)
		ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		srv.handleTransitionApplicationRun(rec, req)

		if rec.Code != http.StatusBadGateway {
			t.Fatalf("expected 502 Bad Gateway when AI is nil, got %d: %s", rec.Code, rec.Body.String())
		}
	})
}

func TestApplicationRuns_InvalidUUID(t *testing.T) {
	srv := &Server{}
	testUser := &models.User{
		ID:    uuid.New(),
		Email: "test-candidate@example.com",
	}

	t.Run("GET invalid UUID returns 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/application-runs/not-a-uuid", nil)
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", "not-a-uuid")
		ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		srv.handleGetApplicationRun(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request for invalid UUID, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("POST transition invalid UUID returns 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/application-runs/not-a-uuid/transition", bytes.NewReader([]byte(`{"new_state":"reviewed"}`)))
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", "not-a-uuid")
		ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		srv.handleTransitionApplicationRun(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request for invalid UUID, got %d: %s", rec.Code, rec.Body.String())
		}
	})
}

