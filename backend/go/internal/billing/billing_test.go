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

func TestBilling_CreditPacksCatalog(t *testing.T) {
	svc := NewBillingService(nil)
	packs := svc.GetCreditPacks()

	if len(packs) != 3 {
		t.Fatalf("Expected 3 standard credit packs, got %d", len(packs))
	}

	expected := map[string]struct {
		credits int
		price   float64
	}{
		"starter": {credits: 10, price: 19.00},
		"pro":     {credits: 35, price: 49.00},
		"power":   {credits: 100, price: 99.00},
	}

	for _, p := range packs {
		exp, ok := expected[p.ID]
		if !ok {
			t.Errorf("Unexpected pack ID: %s", p.ID)
			continue
		}
		if p.Credits != exp.credits {
			t.Errorf("Pack %s expected %d credits, got %d", p.ID, exp.credits, p.Credits)
		}
		if p.PriceUSD != exp.price {
			t.Errorf("Pack %s expected $%.2f, got $%.2f", p.ID, exp.price, p.PriceUSD)
		}
	}
}

func TestBilling_CreditBalanceAndPurchases(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	userID := "user_credit_test_1"

	// Initial balance should be 0
	bal, err := svc.GetCreditBalance(userID)
	if err != nil {
		t.Fatalf("Unexpected error getting initial balance: %v", err)
	}
	if bal.Balance != 0 || bal.LifetimePurchased != 0 || bal.LifetimeUsed != 0 {
		t.Errorf("Expected 0 balance initially, got %+v", bal)
	}

	// Purchase Starter Pack (10 credits for $19)
	bal, err = svc.PurchaseCreditPack(userID, "starter", "tx_starter_1")
	if err != nil {
		t.Fatalf("Failed to purchase starter pack: %v", err)
	}
	if bal.Balance != 10 || bal.LifetimePurchased != 10 {
		t.Errorf("Expected balance 10 after Starter purchase, got %+v", bal)
	}

	// Purchase Pro Pack (35 credits for $49)
	bal, err = svc.PurchaseCreditPack(userID, "pro", "tx_pro_1")
	if err != nil {
		t.Fatalf("Failed to purchase pro pack: %v", err)
	}
	if bal.Balance != 45 || bal.LifetimePurchased != 45 {
		t.Errorf("Expected balance 45 (10+35), got %+v", bal)
	}

	// Debit 1 credit for verified submission
	ok, bal, err := svc.DebitCredit(userID, 1, "receipt_greenhouse_1", "Greenhouse verified receipt")
	if !ok || err != nil {
		t.Fatalf("Expected debit 1 credit to succeed: %v", err)
	}
	if bal.Balance != 44 || bal.LifetimeUsed != 1 {
		t.Errorf("Expected balance 44, lifetime_used 1, got %+v", bal)
	}

	// Refund 1 credit
	bal, err = svc.RefundCredit(userID, 1, "receipt_greenhouse_1", "Cancelled run refund")
	if err != nil {
		t.Fatalf("Failed to refund credit: %v", err)
	}
	if bal.Balance != 45 || bal.LifetimeUsed != 0 {
		t.Errorf("Expected balance 45, lifetime_used 0, got %+v", bal)
	}

	// Check ledger entries
	ledger, err := svc.GetCreditLedger(userID)
	if err != nil {
		t.Fatalf("Failed to get ledger: %v", err)
	}
	if len(ledger) != 4 { // starter, pro, debit, refund
		t.Errorf("Expected 4 ledger entries, got %d", len(ledger))
	}
}

func TestBilling_DebitCredit_InsufficientBalance(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	userID := "user_no_credits"

	// Debit with 0 credits should fail
	ok, bal, err := svc.DebitCredit(userID, 1, "sub_fail", "Unpaid submission")
	if ok || err == nil {
		t.Errorf("Expected debit to fail due to insufficient credits")
	}
	if bal.Balance != 0 {
		t.Errorf("Expected balance 0, got %d", bal.Balance)
	}
}

func TestBilling_ConcurrentCreditDebits(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	userID := "user_concurrent_credits"

	// Start with 100 credits
	_, err := svc.PurchaseCreditPack(userID, "power", "tx_power_1")
	if err != nil {
		t.Fatalf("Failed to purchase power pack: %v", err)
	}

	var wg sync.WaitGroup
	workers := 50
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			svc.DebitCredit(userID, 1, "receipt_concurrent", "Verified submission")
		}(i)
	}
	wg.Wait()

	bal, err := svc.GetCreditBalance(userID)
	if err != nil {
		t.Fatalf("Failed to get balance: %v", err)
	}
	expectedBalance := 100 - workers
	if bal.Balance != expectedBalance || bal.LifetimeUsed != workers {
		t.Errorf("Expected balance %d and lifetime_used %d, got balance %d, used %d",
			expectedBalance, workers, bal.Balance, bal.LifetimeUsed)
	}
}
