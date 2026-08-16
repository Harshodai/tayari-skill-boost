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
	purchaseBody := `{"pack_id":"starter","reference_id":"ch_test_123"}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/purchase", bytes.NewBufferString(purchaseBody))
	req = req.WithContext(auth.WithUserContext(req.Context(), user))
	rec = httptest.NewRecorder()
	s.handlePurchaseCredits(b)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for purchase, got %d: %s", rec.Code, rec.Body.String())
	}

	// 3. Debit 1 credit on verified submission receipt
	debitBody := `{"user_id":"` + userUUID.String() + `","amount":1,"reference_id":"sub_rcpt_1","verified":true}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", bytes.NewBufferString(debitBody))
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

	s := &Server{}
	b := billing.NewBillingService(nil)
	userUUID := uuid.New().String()

	debitBody := `{"user_id":"` + userUUID + `","amount":1,"reference_id":"sub_empty","verified":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/credits/debit", bytes.NewBufferString(debitBody))
	rec := httptest.NewRecorder()
	s.handleDebitCredits(b)(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected 402 Payment Required for insufficient credits, got %d", rec.Code)
	}
}
