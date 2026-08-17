package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"tayari-backend/internal/billing"
)

func TestServiceTokenCannotBePresentedAsUserBearer(t *testing.T) {
	const serviceToken = "service-secret"
	previous := os.Getenv("AI_INTERNAL_TOKEN")
	if err := os.Setenv("AI_INTERNAL_TOKEN", serviceToken); err != nil {
		t.Fatal(err)
	}
	defer os.Setenv("AI_INTERNAL_TOKEN", previous)

	s := &Server{Auth: &MockAuthService{}}
	body := bytes.NewBufferString(`{"user_id":"00000000-0000-0000-0000-000000000001","amount":1,"verified":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", body)
	req.Header.Set("Authorization", "Bearer "+serviceToken)
	rec := httptest.NewRecorder()

	s.internalOrAuthMiddleware(s.handleDebitCredits(billing.NewBillingService(nil))).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("service token presented as bearer must be rejected with 401, got %d", rec.Code)
	}
}

func TestUserBearerCannotAccessInternalBillingMutation(t *testing.T) {
	const serviceToken = "service-secret"
	previous := os.Getenv("AI_INTERNAL_TOKEN")
	if err := os.Setenv("AI_INTERNAL_TOKEN", serviceToken); err != nil {
		t.Fatal(err)
	}
	defer os.Setenv("AI_INTERNAL_TOKEN", previous)

	s := &Server{Auth: &MockAuthService{}}
	body := bytes.NewBufferString(`{"user_id":"00000000-0000-0000-0000-000000000001","amount":1,"verified":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", body)
	req.Header.Set("Authorization", "Bearer valid-user-token")
	rec := httptest.NewRecorder()

	s.internalOrAuthMiddleware(s.handleDebitCredits(billing.NewBillingService(nil))).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("user bearer without a valid auth identity must not access billing mutation, got %d", rec.Code)
	}
}

func TestInternalBillingMutationRequiresExactServiceToken(t *testing.T) {
	const serviceToken = "service-secret"
	previous := os.Getenv("AI_INTERNAL_TOKEN")
	if err := os.Setenv("AI_INTERNAL_TOKEN", serviceToken); err != nil {
		t.Fatal(err)
	}
	defer os.Setenv("AI_INTERNAL_TOKEN", previous)

	s := &Server{Auth: &MockAuthService{}}
	body := bytes.NewBufferString(`{"user_id":"00000000-0000-0000-0000-000000000001","amount":1,"verified":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", body)
	req.Header.Set("X-Internal-Token", "wrong-secret")
	rec := httptest.NewRecorder()

	s.internalOrAuthMiddleware(s.handleDebitCredits(billing.NewBillingService(nil))).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong service token must be rejected with 401, got %d", rec.Code)
	}
}
