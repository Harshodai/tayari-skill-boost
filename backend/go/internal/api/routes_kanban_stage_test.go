package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"tayari-backend/internal/models"
)

func TestApplicationStageValidationEndpoints(t *testing.T) {
	srv := &Server{}
	testUser := &models.User{
		ID:    uuid.New(),
		Email: "test-kanban@example.com",
	}

	t.Run("rejects invalid stage on update stage", func(t *testing.T) {
		reqBody := []byte(`{"stage":"malicious_hacked_stage"}`)
		req := httptest.NewRequest("POST", "/api/v1/applications/123/stage", bytes.NewReader(reqBody))
		req.Header.Set("Content-Type", "application/json")
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		srv.handleUpdateApplicationStage(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("expected status 422 Unprocessable Entity, got %d", w.Code)
		}
	})

	t.Run("rejects empty stage on update stage", func(t *testing.T) {
		reqBody := []byte(`{"stage":""}`)
		req := httptest.NewRequest("POST", "/api/v1/applications/123/stage", bytes.NewReader(reqBody))
		req.Header.Set("Content-Type", "application/json")
		ctx := context.WithValue(req.Context(), contextKeyUser, testUser)
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		srv.handleUpdateApplicationStage(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("expected status 422 Unprocessable Entity, got %d", w.Code)
		}
	})
}
