package billing

import (
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"

	"github.com/google/uuid"
)

func TestBilling_WebhookIdempotency(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	eventID := "evt_stripe_test_123"
	userID := "user_stripe_99"

	// First webhook delivery
	ok1 := svc.ProcessStripeWebhook(eventID, "customer.subscription.created", "cus_99", "sub_99", userID, "pro")
	if !ok1 {
		t.Fatalf("Expected first webhook to succeed")
	}

	ent := svc.GetEntitlement(userID)
	if ent.Plan != "pro" || ent.MeteredLimit != 50000 {
		t.Errorf("Unexpected entitlement: %+v", ent)
	}

	// Retry webhook delivery (duplicate eventID)
	ok2 := svc.ProcessStripeWebhook(eventID, "customer.subscription.created", "cus_99", "sub_99", userID, "pro")
	if !ok2 {
		t.Fatalf("Expected duplicate webhook retry to be handled idempotently")
	}
}

func TestBilling_MeteredLimitsAndExceeded(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	userID := "user_free_tier"
	// Record usage up to 1000 limit
	allowed, err := svc.RecordUsage(userID, 1000)
	if !allowed || err != nil {
		t.Fatalf("Expected 1000 requests to be allowed: %v", err)
	}

	// Exceed limit
	allowedExceeded, errExceeded := svc.RecordUsage(userID, 1)
	if allowedExceeded || errExceeded == nil {
		t.Errorf("Expected request 1001 to be rejected with 429 quota error")
	}
}

func TestBilling_ConcurrentMeteringAccuracy(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	userID := "user_concurrent"
	var wg sync.WaitGroup
	workers := 50

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			svc.RecordUsage(userID, 10)
		}()
	}
	wg.Wait()

	ent := svc.GetEntitlement(userID)
	expectedUsage := workers * 10
	if ent.RequestsUsed != expectedUsage {
		t.Errorf("Expected requests_used %d, got %d", expectedUsage, ent.RequestsUsed)
	}
}

func TestBilling_EntitlementMiddleware(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	handler := svc.EntitlementMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/api/v1/billing/status", nil)
	user := &models.User{ID: uuid.New(), Email: "user@example.com"}
	ctx := auth.WithUserContext(req.Context(), user)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", rec.Code)
	}
}
