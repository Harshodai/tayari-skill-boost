package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

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

func TestBilling_OneTimeCreditPackFulfillmentIsPaidAndIdempotent(t *testing.T) {
	t.Setenv("BILLING_ENABLED", "true")
	t.Setenv("ENV", "staging")

	svc := NewBillingService(nil)
	userID := "user_payment_test"
	if svc.ProcessStripeCreditPackPayment("evt_unpaid", "checkout.session.completed", "cus_test", userID, "starter", "unpaid") {
		t.Fatal("unpaid checkout must not be fulfilled")
	}
	if svc.ProcessStripeCreditPackPayment("evt_unknown", "checkout.session.completed", "cus_test", userID, "unknown", "paid") {
		t.Fatal("unknown pack must not be fulfilled")
	}
	if !svc.ProcessStripeCreditPackPayment("evt_paid", "checkout.session.completed", "cus_test", userID, "starter", "paid") {
		t.Fatal("paid checkout should be fulfilled")
	}
	if !svc.ProcessStripeCreditPackPayment("evt_paid", "checkout.session.completed", "cus_test", userID, "starter", "paid") {
		t.Fatal("duplicate paid checkout should be idempotent")
	}
	balance, err := svc.GetCreditBalance(userID)
	if err != nil {
		t.Fatalf("failed to read fulfilled balance: %v", err)
	}
	if balance.Balance != 10 || balance.LifetimePurchased != 10 {
		t.Fatalf("expected exactly one starter pack fulfillment, got %+v", balance)
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

func TestBilling_UnknownFeatureFailsClosed(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")

	allowed, reason := svc.CanUseFeature("user_unknown_feature", "feature_added_without_entitlement_registration")
	if allowed || reason != "feature_not_registered" {
		t.Fatalf("expected unknown feature to fail closed, got allowed=%v reason=%q", allowed, reason)
	}
}

func TestBilling_DisabledCheckoutFailsClosedEvenWithStripeKey(t *testing.T) {
	t.Setenv("BILLING_ENABLED", "false")
	t.Setenv("ENV", "development")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_provider_gate")

	svc := NewBillingService(nil)
	if _, err := svc.CreateCheckoutSession("user-1", "candidate@example.com", "pro", "https://tayari.example/return"); err == nil || err.Error() != "billing is not enabled for this deployment" {
		t.Fatalf("expected disabled billing to fail closed, got %v", err)
	}
}

func TestBilling_ProductionRequiresStripePriceID(t *testing.T) {
	os.Setenv("ENV", "production")
	os.Setenv("BILLING_ENABLED", "true")
	os.Setenv("STRIPE_SECRET_KEY", "sk_test_provider_gate")
	os.Unsetenv("STRIPE_PRICE_PRO_ID")
	defer os.Unsetenv("ENV")
	defer os.Unsetenv("BILLING_ENABLED")
	defer os.Unsetenv("STRIPE_SECRET_KEY")

	svc := NewBillingService(nil)
	_, err := svc.CreateCheckoutSession("user-1", "candidate@example.com", "pro", "https://tayari.example/return")
	if err == nil || err.Error() != "stripe price ID is not configured for production" {
		t.Fatalf("expected production Stripe price configuration failure, got %v", err)
	}
}

func TestBilling_ProductionRequiresDurableStorage(t *testing.T) {
	os.Setenv("ENV", "production")
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("ENV")
	defer os.Unsetenv("BILLING_ENABLED")

	svc := NewBillingService(nil)
	if _, err := svc.GetCreditBalance("user-production"); err == nil || err.Error() != "billing database unavailable" {
		t.Fatalf("expected credit reads to fail closed, got %v", err)
	}
	if _, err := svc.AddCredits("user-production", 1, "ref", "test"); err == nil || err.Error() != "billing database unavailable" {
		t.Fatalf("expected credit grants to fail closed, got %v", err)
	}
	if ok, _, err := svc.DebitCredit("user-production", 1, "ref", "test"); ok || err == nil || err.Error() != "billing database unavailable" {
		t.Fatalf("expected credit debits to fail closed, got ok=%v err=%v", ok, err)
	}
	if _, err := svc.RefundCredit("user-production", 1, "ref", "test"); err == nil || err.Error() != "billing database unavailable" {
		t.Fatalf("expected credit refunds to fail closed, got %v", err)
	}
}

func TestVerifyStripeSignatureRejectsMissingAndExpiredHeaders(t *testing.T) {
	payload := []byte(`{"id":"evt_test"}`)
	if VerifyStripeSignature(payload, "", "whsec_test") {
		t.Fatal("expected missing signature header to fail")
	}
	oldTimestamp := strconv.FormatInt(time.Now().Add(-10*time.Minute).Unix(), 10)
	if VerifyStripeSignature(payload, "t="+oldTimestamp+",v1=deadbeef", "whsec_test") {
		t.Fatal("expected expired signature to fail")
	}
}

func TestVerifyStripeSignatureAcceptsValidAndRejectsTamperedPayload(t *testing.T) {
	payload := []byte(`{"id":"evt_test","type":"customer.subscription.created"}`)
	secret := "whsec_test"
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(timestamp + "."))
	_, _ = mac.Write(payload)
	signature := hex.EncodeToString(mac.Sum(nil))
	header := "t=" + timestamp + ",v1=" + signature
	if !VerifyStripeSignature(payload, header, secret) {
		t.Fatal("expected valid Stripe signature to pass")
	}
	if VerifyStripeSignature([]byte(`{"id":"evt_tampered"}`), header, secret) {
		t.Fatal("expected tampered Stripe payload to fail")
	}
}

func TestBilling_EmptyStripeEventIDFailsClosed(t *testing.T) {
	svc := NewBillingService(nil)
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")
	if svc.ProcessStripeWebhook("", "customer.subscription.created", "cus", "sub", "user", "pro") {
		t.Fatal("expected empty Stripe event ID to fail closed")
	}
}
