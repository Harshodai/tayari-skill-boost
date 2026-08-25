package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/billing"
	"tayari-backend/internal/models"

	"github.com/google/uuid"
)

// testInternalToken stands in for the shared Go<->Python service secret that
// the credit debit/refund endpoints now require.
const testInternalToken = "test-internal-token"

// TestBillingRoutes_DebitRequiresInternalTokenOrAuth asserts an anonymous
// caller can no longer touch anyone's credit balance.
func TestBillingRoutes_DebitRequiresInternalTokenOrAuth(t *testing.T) {
	os.Setenv("AI_INTERNAL_TOKEN", testInternalToken)
	defer os.Unsetenv("AI_INTERNAL_TOKEN")

	s := &Server{}
	b := billing.NewBillingService(nil)

	body := `{"user_id":"` + uuid.New().String() + `","amount":1,"verified":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	s.handleDebitCredits(b)(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401 for anonymous debit, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/refund", bytes.NewBufferString(body))
	rec = httptest.NewRecorder()
	s.handleRefundCredits(b)(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401 for anonymous refund, got %d", rec.Code)
	}
}

func TestBillingRoutes_DirectPurchaseRequiresInternalToken(t *testing.T) {
	os.Setenv("AI_INTERNAL_TOKEN", testInternalToken)
	defer os.Unsetenv("AI_INTERNAL_TOKEN")

	s := &Server{}
	b := billing.NewBillingService(nil)
	user := &models.User{ID: uuid.New()}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/purchase", bytes.NewBufferString(`{"user_id":"`+user.ID.String()+`","pack_id":"starter","reference_id":"payment_1"}`))
	req = req.WithContext(auth.WithUserContext(req.Context(), user))
	rec := httptest.NewRecorder()
	s.handlePurchaseCredits(b)(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for user-session credit grant, got %d: %s", rec.Code, rec.Body.String())
	}
}

// A signed-in user may not debit someone else's account.
func TestBillingRoutes_DebitRejectsForeignUserID(t *testing.T) {
	s := &Server{}
	b := billing.NewBillingService(nil)
	user := &models.User{ID: uuid.New()}

	body := `{"user_id":"` + uuid.New().String() + `","amount":1,"verified":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", bytes.NewBufferString(body))
	req = req.WithContext(auth.WithUserContext(req.Context(), user))
	rec := httptest.NewRecorder()
	s.handleDebitCredits(b)(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 when debiting another user, got %d", rec.Code)
	}
}

func TestSafeBillingReturnURLRejectsForeignOrigins(t *testing.T) {
	configured := "https://tayari.example/pricing"
	if got := safeBillingReturnURL(configured, "https://evil.example/collect"); got != configured {
		t.Fatalf("expected configured URL for foreign origin, got %q", got)
	}
	if got := safeBillingReturnURL(configured, "https://tayari.example/receipt"); got != "https://tayari.example/receipt" {
		t.Fatalf("expected same-origin URL to be preserved, got %q", got)
	}
	if got := safeBillingReturnURL(configured, "https://tayari.example@evil.example/collect"); got != configured {
		t.Fatalf("expected userinfo/foreign host URL to be rejected, got %q", got)
	}
	if got := safeBillingReturnURL(configured, ""); got != configured {
		t.Fatalf("expected empty request to use configured URL, got %q", got)
	}
}

func TestBillingRoutes_GetCreditPacks(t *testing.T) {
	s := &Server{}
	b := billing.NewBillingService(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/billing/credits/packs", nil)
	rec := httptest.NewRecorder()

	s.handleGetCreditPacks(b)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", rec.Code)
	}

	var resp struct {
		Packs []billing.CreditPack `json:"packs"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(resp.Packs) != 3 {
		t.Fatalf("Expected 3 credit packs, got %d", len(resp.Packs))
	}
}

func TestBillingRoutes_CreditsLifecycle(t *testing.T) {
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")
	os.Setenv("AI_INTERNAL_TOKEN", testInternalToken)
	defer os.Unsetenv("AI_INTERNAL_TOKEN")

	s := &Server{}
	b := billing.NewBillingService(nil)

	userUUID := uuid.New()
	user := &models.User{ID: userUUID, Email: "candidate@example.com"}

	// 1. Initial Credit Balance
	req := httptest.NewRequest(http.MethodGet, "/api/v1/billing/credits", nil)
	req = req.WithContext(auth.WithUserContext(req.Context(), user))
	rec := httptest.NewRecorder()
	s.handleGetCredits(b)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for get credits, got %d", rec.Code)
	}

	var bal billing.UserCreditBalance
	if err := json.NewDecoder(rec.Body).Decode(&bal); err != nil {
		t.Fatalf("Failed to decode balance: %v", err)
	}
	if bal.Balance != 0 {
		t.Errorf("Expected initial balance 0, got %d", bal.Balance)
	}

	// 2. Purchase Starter Pack
	purchaseBody := `{"user_id":"` + userUUID.String() + `","pack_id":"starter","reference_id":"ch_test_123"}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/purchase", bytes.NewBufferString(purchaseBody))
	req.Header.Set("X-Internal-Token", testInternalToken)
	req = req.WithContext(auth.WithUserContext(req.Context(), user))

	rec = httptest.NewRecorder()
	s.handlePurchaseCredits(b)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for purchase, got %d: %s", rec.Code, rec.Body.String())
	}

	// 3. Debit 1 credit on verified submission receipt
	debitBody := `{"user_id":"` + userUUID.String() + `","amount":1,"reference_id":"sub_rcpt_1","verified":true}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", bytes.NewBufferString(debitBody))
	req.Header.Set("X-Internal-Token", testInternalToken)
	rec = httptest.NewRecorder()
	s.handleDebitCredits(b)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for debit, got %d: %s", rec.Code, rec.Body.String())
	}

	var debitResp struct {
		Status  string                    `json:"status"`
		Debited int                       `json:"debited"`
		Balance billing.UserCreditBalance `json:"balance"`
	}
	json.NewDecoder(rec.Body).Decode(&debitResp)
	if debitResp.Balance.Balance != 9 || debitResp.Debited != 1 {
		t.Errorf("Expected balance 9 after 1 debit from 10, got %d", debitResp.Balance.Balance)
	}

	// 4. Unverified submission receives 0 charge / no debit
	unverifiedBody := `{"user_id":"` + userUUID.String() + `","amount":1,"reference_id":"sub_rcpt_fail","verified":false}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", bytes.NewBufferString(unverifiedBody))
	req.Header.Set("X-Internal-Token", testInternalToken)
	rec = httptest.NewRecorder()
	s.handleDebitCredits(b)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for unverified debit, got %d", rec.Code)
	}
	var unvResp struct {
		Status  string `json:"status"`
		Debited int    `json:"debited"`
	}
	json.NewDecoder(rec.Body).Decode(&unvResp)
	if unvResp.Status != "no_charge" || unvResp.Debited != 0 {
		t.Errorf("Expected no_charge status and 0 debited, got %+v", unvResp)
	}

	// 5. Refund debited credit
	refundBody := `{"user_id":"` + userUUID.String() + `","amount":1,"reference_id":"sub_rcpt_1"}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/refund", bytes.NewBufferString(refundBody))
	req.Header.Set("X-Internal-Token", testInternalToken)
	rec = httptest.NewRecorder()
	s.handleRefundCredits(b)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for refund, got %d", rec.Code)
	}
	var refundResp struct {
		Status   string                    `json:"status"`
		Refunded int                       `json:"refunded"`
		Balance  billing.UserCreditBalance `json:"balance"`
	}
	json.NewDecoder(rec.Body).Decode(&refundResp)
	if refundResp.Balance.Balance != 10 {
		t.Errorf("Expected balance restored to 10, got %d", refundResp.Balance.Balance)
	}
}

func TestBillingRoutes_DebitInsufficientCredits(t *testing.T) {
	os.Setenv("BILLING_ENABLED", "true")
	defer os.Unsetenv("BILLING_ENABLED")
	os.Setenv("AI_INTERNAL_TOKEN", testInternalToken)
	defer os.Unsetenv("AI_INTERNAL_TOKEN")

	s := &Server{}
	b := billing.NewBillingService(nil)
	userUUID := uuid.New().String()

	debitBody := `{"user_id":"` + userUUID + `","amount":1,"reference_id":"sub_empty","verified":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", bytes.NewBufferString(debitBody))
	req.Header.Set("X-Internal-Token", testInternalToken)
	rec := httptest.NewRecorder()
	s.handleDebitCredits(b)(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected 402 Payment Required for insufficient credits, got %d", rec.Code)
	}
}
