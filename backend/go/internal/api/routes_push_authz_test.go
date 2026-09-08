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

// A signed-in caller must never be able to target another tenant's push
// subscriptions by passing that tenant's id in the request body. Regression
// test for the cross-tenant IDOR fixed in handlePushSend.
func TestPushSendRejectsOtherUsersUserID(t *testing.T) {
	caller := &models.User{ID: uuid.MustParse("00000000-0000-0000-0000-000000000001")}
	victim := "00000000-0000-0000-0000-000000000002"

	s := &Server{}
	body := bytes.NewBufferString(`{"user_id":"` + victim + `","title":"t","body":"b"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/push/send", body)
	req = req.WithContext(context.WithValue(req.Context(), contextKeyUser, caller))
	rec := httptest.NewRecorder()

	s.handlePushSend(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("cross-tenant push send must be rejected with 403, got %d (%s)", rec.Code, rec.Body.String())
	}
}

// Unauthenticated callers get 401, never a database round-trip.
func TestPushSendRequiresAuthenticatedUser(t *testing.T) {
	s := &Server{}
	body := bytes.NewBufferString(`{"user_id":"00000000-0000-0000-0000-000000000001"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/push/send", body)
	rec := httptest.NewRecorder()

	s.handlePushSend(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated push send must be 401, got %d", rec.Code)
	}
}
