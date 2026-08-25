package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/stripe/stripe-go/v81"
	billingportalsession "github.com/stripe/stripe-go/v81/billingportal/session"
	checkoutsession "github.com/stripe/stripe-go/v81/checkout/session"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/database"
)

// Entitlement represents a user's subscription tier & capabilities
type Entitlement struct {
	UserID       string    `json:"user_id"`
	Plan         string    `json:"plan"` // "free" | "pro" | "enterprise"
	IsActive     bool      `json:"is_active"`
	MeteredLimit int       `json:"metered_limit"`
	RequestsUsed int       `json:"requests_used"`
	ExpiresAt    time.Time `json:"expires_at"`
	CustomerID   string    `json:"customer_id,omitempty"`
}

// CreditPack represents a purchasable pack of submission credits
type CreditPack struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Credits     int     `json:"credits"`
	PriceUSD    float64 `json:"price_usd"`
	PriceCents  int     `json:"price_cents"`
	Description string  `json:"description"`
}

// UserCreditBalance represents a user's current credit balance & lifetime totals
type UserCreditBalance struct {
	UserID            string    `json:"user_id"`
	Balance           int       `json:"balance"`
	LifetimePurchased int       `json:"lifetime_purchased"`
	LifetimeUsed      int       `json:"lifetime_used"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// CreditLedgerEntry records every credit transaction (purchase, debit, refund, grant)
type CreditLedgerEntry struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Amount      int       `json:"amount"` // positive for credit in, negative for debit out
	Type        string    `json:"type"`   // "purchase", "debit", "refund", "grant"
	Description string    `json:"description"`
	ReferenceID string    `json:"reference_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Standard credit pack definitions
var StandardCreditPacks = []CreditPack{
	{
		ID:          "starter",
		Name:        "Starter",
		Credits:     10,
		PriceUSD:    19.00,
		PriceCents:  1900,
		Description: "10 verified submissions for $19",
	},
	{
		ID:          "pro",
		Name:        "Pro",
		Credits:     35,
		PriceUSD:    49.00,
		PriceCents:  4900,
		Description: "35 verified submissions for $49",
	},
	{
		ID:          "power",
		Name:        "Power",
		Credits:     100,
		PriceUSD:    99.00,
		PriceCents:  9900,
		Description: "100 verified submissions for $99",
	},
}

func creditPackByID(packID string) (*CreditPack, bool) {
	for _, pack := range StandardCreditPacks {
		if strings.EqualFold(strings.TrimSpace(pack.ID), strings.TrimSpace(packID)) {
			matched := pack
			return &matched, true
		}
	}
	return nil, false
}

type BillingService struct {
	db              *database.DB
	mu              sync.RWMutex
	entitlements    map[string]*Entitlement
	processedEvents map[string]time.Time
	creditBalances  map[string]*UserCreditBalance
	creditLedger    map[string][]CreditLedgerEntry
}

func NewBillingService(db *database.DB) *BillingService {
	apiKey := os.Getenv("STRIPE_SECRET_KEY")
	if apiKey != "" {
		stripe.Key = apiKey
	}

	return &BillingService{
		db:              db,
		entitlements:    make(map[string]*Entitlement),
		processedEvents: make(map[string]time.Time),
		creditBalances:  make(map[string]*UserCreditBalance),
		creditLedger:    make(map[string][]CreditLedgerEntry),
	}
}

// IsBillingEnabled checks env kill-switch (default false for self-hosters)
func IsBillingEnabled() bool {
	return os.Getenv("BILLING_ENABLED") == "true"
}

func isProductionBilling() bool {
	return IsBillingEnabled() && strings.EqualFold(os.Getenv("ENV"), "production")
}

func (b *BillingService) requireDurableBillingStorage() error {
	if isProductionBilling() && (b.db == nil || b.db.Conn == nil) {
		return errors.New("billing database unavailable")
	}
	return nil
}

func (b *BillingService) GetEntitlement(userID string) *Entitlement {
	// Self-hosters or disabled billing get unlimited Pro entitlement
	if !IsBillingEnabled() {
		return &Entitlement{
			UserID:       userID,
			Plan:         "pro_self_hosted",
			IsActive:     true,
			MeteredLimit: 999999,
			RequestsUsed: 0,
		}
	}

	// Try DB query first if database connection is available
	if b.db != nil && b.db.Conn != nil {
		var ent Entitlement
		var custID sqlNullString
		var expAt sqlNullTime
		query := `
			SELECT user_id, plan, (status = 'active') as is_active, metered_limit, requests_used, current_period_end, stripe_customer_id
			FROM public.user_subscriptions
			WHERE user_id = $1::uuid
		`
		err := b.db.Conn.QueryRow(query, userID).Scan(
			&ent.UserID,
			&ent.Plan,
			&ent.IsActive,
			&ent.MeteredLimit,
			&ent.RequestsUsed,
			&expAt,
			&custID,
		)
		if err == nil {
			if custID.Valid {
				ent.CustomerID = custID.String
			}
			if expAt.Valid {
				ent.ExpiresAt = expAt.Time
			} else {
				ent.ExpiresAt = time.Now().AddDate(0, 1, 0)
			}
			return &ent
		}
		if !errors.Is(err, sql.ErrNoRows) {
			// A transient DB error is not the same as "no subscription row
			// exists". Never turn an entitlement outage into a free or
			// cached entitlement: that would grant paid features while the
			// source of truth is unavailable.
			log.Printf("[billing] GetEntitlement: DB query failed for user %s (failing closed): %v", userID, err)
			return &Entitlement{
				UserID:       userID,
				Plan:         "unavailable",
				IsActive:     false,
				MeteredLimit: 0,
				ExpiresAt:    time.Time{},
			}
		}
	}

	// In-memory fallback
	b.mu.RLock()
	ent, exists := b.entitlements[userID]
	b.mu.RUnlock()

	if !exists {
		return &Entitlement{
			UserID:       userID,
			Plan:         "free",
			IsActive:     true,
			MeteredLimit: 1000,
			RequestsUsed: 0,
			ExpiresAt:    time.Now().AddDate(0, 1, 0),
		}
	}
	copyEnt := *ent
	return &copyEnt
}

// Feature tier constants
const (
	TierFree       = "free"
	TierPro        = "pro"
	TierEnterprise = "enterprise"
	TierSelfHosted = "pro_self_hosted" // self-hosters get full pro
)

// FEATURE_LIMITS maps feature names to the minimum plan required.
// TierFree (rank 0) as the requirement means the feature is available on
// ALL plans — free, pro, and enterprise alike — not "free plan only";
// planRank(anyActivePlan) is never less than planRank(TierFree)==0, so the
// requireFeature gate always passes for these entries.
var FEATURE_LIMITS = map[string]string{
	// Free tier features
	"resume_optimize": TierFree,
	"ats_score":       TierFree,
	"cover_letter":    TierFree,
	"job_search":      TierFree,
	"save_job":        TierFree,
	"knowledge_graph": TierFree,
	"dashboard_stats": TierFree,
	// Pro-only features
	"interview_copilot": TierPro,
	"voice_coach":       TierPro,
	"deep_ats":          TierPro,
	"agent_reach":       TierPro,
	"autopilot":         TierPro,
	"recruiter_lookup":  TierPro,
	"offer_calculate":   TierPro,
	"linkedin_analyze":  TierPro,
	"truth_check":       TierPro,
	// Enterprise-only features
	"multi_tenant_admin": TierEnterprise,
	"custom_branding":    TierEnterprise,
}

// planRank returns a numeric rank for comparison.
func planRank(plan string) int {
	p := strings.ToLower(plan)
	switch p {
	case TierFree:
		return 0
	case TierPro, TierSelfHosted:
		return 1
	case TierEnterprise:
		return 2
	}
	// Stripe webhook events can deliver un-normalized plan identifiers —
	// raw price IDs, or lookup keys like "pro_monthly"/"enterprise_annual" —
	// rather than the canonical "pro"/"enterprise" tier names (see
	// ProcessStripeWebhook, which stores whatever Stripe sends verbatim).
	// Match on whole "_"/"-"-delimited tokens (not bare substring) so a
	// paying customer with a variant plan string isn't silently ranked the
	// same as free (rank 0) — while "steam" (contains "team") and
	// "free_promo"/"promo_2026"/"price_promo" (contain "pro") don't
	// falsely match "team"/"pro".
	tokens := strings.FieldsFunc(p, func(r rune) bool {
		return r == '_' || r == '-'
	})
	hasToken := func(target string) bool {
		for _, t := range tokens {
			if t == target {
				return true
			}
		}
		return false
	}
	if hasToken("enterprise") || hasToken("team") {
		return 2
	}
	if hasToken("pro") {
		return 1
	}
	return 0
}

// CanUseFeature returns true if the user's current entitlement grants
// access to the named feature. feature must be a key in FEATURE_LIMITS.
// Returns (true, "") if allowed, (false, reason) if denied.
func (b *BillingService) CanUseFeature(userID, feature string) (bool, string) {
	if !IsBillingEnabled() {
		return true, "" // self-hosted: unrestricted
	}
	requiredPlan, known := FEATURE_LIMITS[feature]
	if !known {
		return false, "feature_not_registered"
	}
	ent := b.GetEntitlement(userID)
	if ent.Plan == "unavailable" {
		return false, "entitlement_unavailable"
	}
	if !ent.IsActive {
		return false, "subscription_inactive"
	}
	if planRank(ent.Plan) < planRank(requiredPlan) {
		return false, "plan_upgrade_required: feature '" + feature + "' requires " + requiredPlan + " plan"
	}
	return true, ""
}

// Helper types for SQL Null values
type sqlNullString struct {
	String string
	Valid  bool
}

func (s *sqlNullString) Scan(value interface{}) error {
	if value == nil {
		s.String, s.Valid = "", false
		return nil
	}
	s.Valid = true
	switch v := value.(type) {
	case string:
		s.String = v
	case []byte:
		s.String = string(v)
	}
	return nil
}

type sqlNullTime struct {
	Time  time.Time
	Valid bool
}

func (t *sqlNullTime) Scan(value interface{}) error {
	if value == nil {
		t.Time, t.Valid = time.Time{}, false
		return nil
	}
	t.Valid = true
	if tm, ok := value.(time.Time); ok {
		t.Time = tm
		return nil
	}
	return nil
}

func (b *BillingService) RecordUsage(userID string, count int) (bool, error) {
	if !IsBillingEnabled() {
		return true, nil
	}

	if b.db != nil && b.db.Conn != nil {
		var limit, used int
		err := b.db.Conn.QueryRow(`
			INSERT INTO public.user_subscriptions (user_id, plan, metered_limit, requests_used)
			VALUES ($1::uuid, 'free', 1000, $2)
			ON CONFLICT (user_id) DO UPDATE
			SET requests_used = public.user_subscriptions.requests_used + EXCLUDED.requests_used
			RETURNING metered_limit, requests_used
		`, userID, count).Scan(&limit, &used)
		if err == nil {
			if used > limit {
				return false, errors.New("token quota exceeded - upgrade at /pricing")
			}
			return true, nil
		}
	}

	b.mu.Lock()
	defer b.mu.Unlock()
	ent, exists := b.entitlements[userID]
	if !exists {
		ent = &Entitlement{UserID: userID, Plan: "free", IsActive: true, MeteredLimit: 1000, RequestsUsed: 0}
		b.entitlements[userID] = ent
	}

	if ent.RequestsUsed+count > ent.MeteredLimit {
		return false, errors.New("rate limit / token quota exceeded - upgrade at /pricing")
	}

	ent.RequestsUsed += count
	return true, nil
}

// CreateCheckoutSession initiates a live one-time Stripe Checkout flow for a credit pack.
func (b *BillingService) CreateCheckoutSession(userID, userEmail, plan, returnURL string) (string, error) {
	// Billing is an explicit deployment capability. Never create a live Stripe
	// session merely because a secret happens to be present in the environment.
	if !IsBillingEnabled() {
		return "", errors.New("billing is not enabled for this deployment")
	}
	if stripe.Key == "" {
		return "", errors.New("stripe API key is not configured on server")
	}

	packID := strings.ToLower(strings.TrimSpace(plan))
	if _, ok := creditPackByID(packID); !ok {
		return "", errors.New("invalid credit pack")
	}
	priceEnv := map[string]string{
		"starter": "STRIPE_PRICE_STARTER_ID",
		"pro":     "STRIPE_PRICE_PRO_ID",
		"power":   "STRIPE_PRICE_POWER_ID",
	}[packID]
	priceID := os.Getenv(priceEnv)
	if priceID == "" {
		if strings.EqualFold(os.Getenv("ENV"), "production") {
			return "", errors.New("stripe price ID is not configured for production")
		}
		// Fallback is deliberately development-only and never represents a live price.
		priceID = "price_" + packID + "_default"
	}

	successURL := returnURL + "?session_id={CHECKOUT_SESSION_ID}&billing=success"
	cancelURL := returnURL + "?billing=cancel"

	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		Mode:               stripe.String(string(stripe.CheckoutSessionModePayment)),
		CustomerEmail:      stripe.String(userEmail),
		ClientReferenceID:  stripe.String(userID),
		SuccessURL:         stripe.String(successURL),
		CancelURL:          stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
	}
	params.AddMetadata("user_id", userID)
	params.AddMetadata("plan", packID)
	params.AddMetadata("pack_id", packID)

	s, err := checkoutsession.New(params)
	if err != nil {
		log.Printf("[stripe] Error creating checkout session: %v", err)
		return "", fmt.Errorf("failed to create Stripe checkout session: %w", err)
	}

	return s.URL, nil
}

// CreatePortalSession creates a Stripe Billing Customer Portal session
func (b *BillingService) CreatePortalSession(userID, returnURL string) (string, error) {
	if stripe.Key == "" {
		return "", errors.New("stripe API key is not configured on server")
	}

	ent := b.GetEntitlement(userID)
	if ent.CustomerID == "" {
		return "", errors.New("no stripe customer associated with this account")
	}

	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(ent.CustomerID),
		ReturnURL: stripe.String(returnURL),
	}

	s, err := billingportalsession.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create Stripe portal session: %w", err)
	}

	return s.URL, nil
}

// ProcessStripeWebhook processes subscription events idempotently with a durable
// event claim and an atomic subscription update when PostgreSQL is available.
func (b *BillingService) ProcessStripeWebhook(eventID, eventType, customerID, subscriptionID, userID, plan string) bool {
	if !IsBillingEnabled() {
		return true
	}
	if strings.TrimSpace(eventID) == "" {
		return false
	}

	limit := 1000
	p := strings.ToLower(plan)
	if strings.Contains(p, "pro") || p == "price_pro" {
		limit = 50000
	} else if strings.Contains(p, "enterprise") || strings.Contains(p, "team") || p == "price_enterprise" {
		limit = 1000000
	}

	status := "active"
	if eventType == "customer.subscription.deleted" || eventType == "customer.subscription.canceled" {
		status = "canceled"
		limit = 1000
	}
	expiresAt := time.Now().AddDate(0, 1, 0)

	if b.db != nil && b.db.Conn != nil {
		if strings.TrimSpace(userID) == "" {
			log.Printf("[billing] Stripe event %s has no user_id metadata; refusing entitlement mutation", eventID)
			return false
		}
		tx, err := b.db.Conn.Begin()
		if err != nil {
			log.Printf("[billing] Failed to begin Stripe event transaction: %v", err)
			return false
		}
		defer tx.Rollback()

		var claimedEventID string
		err = tx.QueryRow(`
			INSERT INTO public.stripe_webhook_events (event_id, event_type)
			VALUES ($1, $2)
			ON CONFLICT (event_id) DO NOTHING
			RETURNING event_id
		`, eventID, eventType).Scan(&claimedEventID)
		if errors.Is(err, sql.ErrNoRows) {
			// Duplicate delivery: the original transaction already claimed it.
			return true
		}
		if err != nil {
			log.Printf("[billing] Failed to claim Stripe event %s: %v", eventID, err)
			return false
		}

		_, err = tx.Exec(`
			INSERT INTO public.user_subscriptions
				(user_id, stripe_customer_id, stripe_subscription_id, plan, status, metered_limit, requests_used, current_period_end, updated_at)
			VALUES ($1::uuid, $2, $3, $4, $5, $6, 0, $7, NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				stripe_customer_id = EXCLUDED.stripe_customer_id,
				stripe_subscription_id = EXCLUDED.stripe_subscription_id,
				plan = EXCLUDED.plan,
				status = EXCLUDED.status,
				metered_limit = EXCLUDED.metered_limit,
				current_period_end = EXCLUDED.current_period_end,
				updated_at = NOW()
		`, userID, customerID, subscriptionID, plan, status, limit, expiresAt)
		if err != nil {
			log.Printf("[billing] Failed to save subscription for Stripe event %s: %v", eventID, err)
			return false
		}
		if err := tx.Commit(); err != nil {
			log.Printf("[billing] Failed to commit Stripe event %s: %v", eventID, err)
			return false
		}

		b.mu.Lock()
		b.entitlements[userID] = &Entitlement{
			UserID:       userID,
			Plan:         plan,
			IsActive:     status == "active",
			MeteredLimit: limit,
			RequestsUsed: 0,
			ExpiresAt:    expiresAt,
			CustomerID:   customerID,
		}
		b.mu.Unlock()
		return true
	}

	// Development-only fallback for the in-memory test/self-hosted service.
	b.mu.Lock()
	now := time.Now()
	for id, t := range b.processedEvents {
		if now.Sub(t) > 24*time.Hour {
			delete(b.processedEvents, id)
		}
	}
	if _, exists := b.processedEvents[eventID]; exists {
		b.mu.Unlock()
		return true
	}
	b.processedEvents[eventID] = now
	b.entitlements[userID] = &Entitlement{
		UserID:       userID,
		Plan:         plan,
		IsActive:     status == "active",
		MeteredLimit: limit,
		RequestsUsed: 0,
		ExpiresAt:    expiresAt,
		CustomerID:   customerID,
	}
	b.mu.Unlock()
	return true
}

// ProcessStripeCreditPackPayment fulfills a one-time credit pack only for a paid
// Checkout Session event. The event claim and balance/ledger mutation are atomic
// when PostgreSQL is available, so Stripe retries cannot double-grant credits.
func (b *BillingService) ProcessStripeCreditPackPayment(eventID, eventType, customerID, userID, packID, paymentStatus string) bool {
	_ = customerID // retained for webhook compatibility and future customer binding.
	if !IsBillingEnabled() {
		return true
	}
	pack, ok := creditPackByID(packID)
	if !ok || strings.TrimSpace(eventID) == "" || strings.TrimSpace(userID) == "" || paymentStatus != string(stripe.CheckoutSessionPaymentStatusPaid) {
		return false
	}

	if b.db != nil && b.db.Conn != nil {
		tx, err := b.db.Conn.Begin()
		if err != nil {
			return false
		}
		defer tx.Rollback()

		var claimed string
		err = tx.QueryRow(`INSERT INTO public.stripe_webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`, eventID, eventType).Scan(&claimed)
		if errors.Is(err, sql.ErrNoRows) {
			return true
		}
		if err != nil {
			return false
		}
		_, err = tx.Exec(`INSERT INTO public.user_credits (user_id, balance, lifetime_purchased, lifetime_used, updated_at) VALUES ($1::uuid, $2, $2, 0, NOW()) ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + EXCLUDED.balance, lifetime_purchased = public.user_credits.lifetime_purchased + EXCLUDED.lifetime_purchased, updated_at = NOW()`, userID, pack.Credits)
		if err != nil {
			return false
		}
		_, err = tx.Exec(`INSERT INTO public.credit_ledger (id, user_id, amount, type, description, reference_id, created_at) VALUES ($1, $2::uuid, $3, 'purchase', $4, $5, NOW())`, "stripe_"+eventID, userID, pack.Credits, fmt.Sprintf("Purchased %s Pack (%d credits for $%.2f)", pack.Name, pack.Credits, pack.PriceUSD), eventID)
		if err != nil {
			return false
		}
		return tx.Commit() == nil
	}

	if isProductionBilling() {
		return false
	}
	b.mu.Lock()
	if _, seen := b.processedEvents[eventID]; seen {
		b.mu.Unlock()
		return true
	}
	b.mu.Unlock()
	if _, err := b.PurchaseCreditPack(userID, pack.ID, eventID); err != nil {
		return false
	}
	b.mu.Lock()
	b.processedEvents[eventID] = time.Now()
	b.mu.Unlock()
	return true
}

func VerifyStripeSignature(payload []byte, sigHeader, secret string) bool {
	if secret == "" || sigHeader == "" {
		return false
	}

	var timestampStr string
	var v1Signatures []string
	parts := strings.Split(sigHeader, ",")
	for _, part := range parts {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) == 2 {
			if kv[0] == "t" {
				timestampStr = kv[1]
			} else if kv[0] == "v1" {
				v1Signatures = append(v1Signatures, kv[1])
			}
		}
	}

	if timestampStr == "" || len(v1Signatures) == 0 {
		return false
	}

	ts, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return false
	}

	now := time.Now().Unix()
	if now-ts > 300 || ts-now > 300 {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestampStr + "."))
	mac.Write(payload)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	for _, sig := range v1Signatures {
		if hmac.Equal([]byte(expectedSig), []byte(sig)) {
			return true
		}
	}

	return false
}

// EntitlementMiddleware enforces tier metering
func (b *BillingService) EntitlementMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !IsBillingEnabled() {
			next.ServeHTTP(w, r)
			return
		}

		user, ok := auth.UserFromContext(r.Context())
		if !ok || user == nil || user.ID == [16]byte{} {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprint(w, `{"error":"unauthorized - valid authentication required"}`)
			return
		}
		userID := user.ID.String()

		allowed, err := b.RecordUsage(userID, 1)
		if !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			fmt.Fprintf(w, `{"error":"rate limit / token quota exceeded","fix":%q}`, err.Error())
			return
		}

		next.ServeHTTP(w, r)
	})
}

// GetCreditPacks returns the list of purchasable submission credit packs
func (b *BillingService) GetCreditPacks() []CreditPack {
	packs := make([]CreditPack, len(StandardCreditPacks))
	copy(packs, StandardCreditPacks)
	return packs
}

// GetCreditBalance returns the user's current credit balance
func (b *BillingService) GetCreditBalance(userID string) (*UserCreditBalance, error) {
	if userID == "" {
		return nil, errors.New("user ID is required")
	}

	if !IsBillingEnabled() {
		return &UserCreditBalance{
			UserID:            userID,
			Balance:           999999,
			LifetimePurchased: 999999,
			LifetimeUsed:      0,
			UpdatedAt:         time.Now(),
		}, nil
	}
	if err := b.requireDurableBillingStorage(); err != nil {
		return nil, err
	}

	// Try DB query first if database connection is available
	if b.db != nil && b.db.Conn != nil {
		var bal UserCreditBalance
		bal.UserID = userID
		query := `
			SELECT balance, lifetime_purchased, lifetime_used, updated_at
			FROM public.user_credits
			WHERE user_id = $1::uuid
		`
		err := b.db.Conn.QueryRow(query, userID).Scan(
			&bal.Balance,
			&bal.LifetimePurchased,
			&bal.LifetimeUsed,
			&bal.UpdatedAt,
		)
		if err == nil {
			return &bal, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			log.Printf("[billing] GetCreditBalance DB query error for %s: %v", userID, err)
			if isProductionBilling() {
				return nil, errors.New("billing database unavailable")
			}
		}
	}

	// In-memory fallback is development-only when billing is enabled.
	if isProductionBilling() {
		return nil, errors.New("billing database unavailable")
	}
	b.mu.RLock()
	bal, exists := b.creditBalances[userID]
	b.mu.RUnlock()

	if !exists {
		return &UserCreditBalance{
			UserID:            userID,
			Balance:           0,
			LifetimePurchased: 0,
			LifetimeUsed:      0,
			UpdatedAt:         time.Now(),
		}, nil
	}

	copyBal := *bal
	return &copyBal, nil
}

// AddCredits grants or purchases credits for a user
func (b *BillingService) AddCredits(userID string, amount int, referenceID, description string) (*UserCreditBalance, error) {
	if userID == "" {
		return nil, errors.New("user ID is required")
	}
	if amount <= 0 {
		return nil, errors.New("credit amount must be positive")
	}
	if err := b.requireDurableBillingStorage(); err != nil {
		return nil, err
	}

	now := time.Now()

	// Persist to PostgreSQL if available
	if b.db != nil && b.db.Conn != nil {
		var bal UserCreditBalance
		bal.UserID = userID
		query := `
			INSERT INTO public.user_credits (user_id, balance, lifetime_purchased, lifetime_used, updated_at)
			VALUES ($1::uuid, $2, $2, 0, NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				balance = public.user_credits.balance + EXCLUDED.balance,
				lifetime_purchased = public.user_credits.lifetime_purchased + EXCLUDED.lifetime_purchased,
				updated_at = NOW()
			RETURNING balance, lifetime_purchased, lifetime_used, updated_at
		`
		err := b.db.Conn.QueryRow(query, userID, amount).Scan(
			&bal.Balance,
			&bal.LifetimePurchased,
			&bal.LifetimeUsed,
			&bal.UpdatedAt,
		)
		if err == nil {
			// Record ledger entry
			_, _ = b.db.Conn.Exec(`
				INSERT INTO public.credit_ledger (id, user_id, amount, type, description, reference_id, created_at)
				VALUES ($1, $2::uuid, $3, 'purchase', $4, $5, NOW())
			`, fmt.Sprintf("led_%d", time.Now().UnixNano()), userID, amount, description, referenceID)

			b.mu.Lock()
			b.creditBalances[userID] = &bal
			b.mu.Unlock()
			return &bal, nil
		}
		log.Printf("[billing] AddCredits DB error for %s: %v", userID, err)
		if isProductionBilling() {
			return nil, errors.New("billing database unavailable")
		}
	}
	if isProductionBilling() {
		return nil, errors.New("billing database unavailable")
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	bal, exists := b.creditBalances[userID]
	if !exists {
		bal = &UserCreditBalance{
			UserID:            userID,
			Balance:           0,
			LifetimePurchased: 0,
			LifetimeUsed:      0,
			UpdatedAt:         now,
		}
		b.creditBalances[userID] = bal
	}

	bal.Balance += amount
	bal.LifetimePurchased += amount
	bal.UpdatedAt = now

	entry := CreditLedgerEntry{
		ID:          fmt.Sprintf("led_%d", time.Now().UnixNano()),
		UserID:      userID,
		Amount:      amount,
		Type:        "purchase",
		Description: description,
		ReferenceID: referenceID,
		CreatedAt:   now,
	}
	b.creditLedger[userID] = append(b.creditLedger[userID], entry)

	copyBal := *bal
	return &copyBal, nil
}

// PurchaseCreditPack purchases a named credit pack for a user
func (b *BillingService) PurchaseCreditPack(userID string, packID string, referenceID string) (*UserCreditBalance, error) {
	matchedPack, ok := creditPackByID(packID)
	if !ok {
		return nil, fmt.Errorf("invalid credit pack '%s'", packID)
	}

	desc := fmt.Sprintf("Purchased %s Pack (%d credits for $%.2f)", matchedPack.Name, matchedPack.Credits, matchedPack.PriceUSD)
	return b.AddCredits(userID, matchedPack.Credits, referenceID, desc)
}

// DebitCredit deducts credits (default 1) for a verified submission receipt
func (b *BillingService) DebitCredit(userID string, amount int, referenceID, description string) (bool, *UserCreditBalance, error) {
	if userID == "" {
		return false, nil, errors.New("user ID is required")
	}
	if amount <= 0 {
		amount = 1
	}

	if !IsBillingEnabled() {
		return true, &UserCreditBalance{
			UserID:            userID,
			Balance:           999999,
			LifetimePurchased: 999999,
			LifetimeUsed:      0,
			UpdatedAt:         time.Now(),
		}, nil
	}
	if err := b.requireDurableBillingStorage(); err != nil {
		return false, nil, err
	}

	now := time.Now()

	// Persist to PostgreSQL if available
	if b.db != nil && b.db.Conn != nil {
		var bal UserCreditBalance
		bal.UserID = userID
		query := `
			UPDATE public.user_credits
			SET balance = balance - $2,
				lifetime_used = lifetime_used + $2,
				updated_at = NOW()
			WHERE user_id = $1::uuid AND balance >= $2
			RETURNING balance, lifetime_purchased, lifetime_used, updated_at
		`
		err := b.db.Conn.QueryRow(query, userID, amount).Scan(
			&bal.Balance,
			&bal.LifetimePurchased,
			&bal.LifetimeUsed,
			&bal.UpdatedAt,
		)
		if err == nil {
			_, _ = b.db.Conn.Exec(`
				INSERT INTO public.credit_ledger (id, user_id, amount, type, description, reference_id, created_at)
				VALUES ($1, $2::uuid, $3, 'debit', $4, $5, NOW())
			`, fmt.Sprintf("led_%d", time.Now().UnixNano()), userID, -amount, description, referenceID)

			b.mu.Lock()
			b.creditBalances[userID] = &bal
			b.mu.Unlock()
			return true, &bal, nil
		}
		if errors.Is(err, sql.ErrNoRows) {
			currentBal, _ := b.GetCreditBalance(userID)
			return false, currentBal, errors.New("insufficient credit balance for verified submission")
		}
		if isProductionBilling() {
			return false, nil, errors.New("billing database unavailable")
		}
	}
	if isProductionBilling() {
		return false, nil, errors.New("billing database unavailable")
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	bal, exists := b.creditBalances[userID]
	if !exists || bal.Balance < amount {
		currentBal := &UserCreditBalance{
			UserID:            userID,
			Balance:           0,
			LifetimePurchased: 0,
			LifetimeUsed:      0,
			UpdatedAt:         now,
		}
		if exists {
			*currentBal = *bal
		}
		return false, currentBal, errors.New("insufficient credit balance for verified submission")
	}

	bal.Balance -= amount
	bal.LifetimeUsed += amount
	bal.UpdatedAt = now

	entry := CreditLedgerEntry{
		ID:          fmt.Sprintf("led_%d", time.Now().UnixNano()),
		UserID:      userID,
		Amount:      -amount,
		Type:        "debit",
		Description: description,
		ReferenceID: referenceID,
		CreatedAt:   now,
	}
	b.creditLedger[userID] = append(b.creditLedger[userID], entry)

	copyBal := *bal
	return true, &copyBal, nil
}

// RefundCredit restores previously debited credits (e.g. on contested or cancelled submissions)
func (b *BillingService) RefundCredit(userID string, amount int, referenceID, description string) (*UserCreditBalance, error) {
	if userID == "" {
		return nil, errors.New("user ID is required")
	}
	if amount <= 0 {
		amount = 1
	}
	if err := b.requireDurableBillingStorage(); err != nil {
		return nil, err
	}

	now := time.Now()

	// Persist to PostgreSQL if available
	if b.db != nil && b.db.Conn != nil {
		var bal UserCreditBalance
		bal.UserID = userID
		query := `
			INSERT INTO public.user_credits (user_id, balance, lifetime_purchased, lifetime_used, updated_at)
			VALUES ($1::uuid, $2, 0, 0, NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				balance = public.user_credits.balance + EXCLUDED.balance,
				lifetime_used = GREATEST(0, public.user_credits.lifetime_used - EXCLUDED.balance),
				updated_at = NOW()
			RETURNING balance, lifetime_purchased, lifetime_used, updated_at
		`
		err := b.db.Conn.QueryRow(query, userID, amount).Scan(
			&bal.Balance,
			&bal.LifetimePurchased,
			&bal.LifetimeUsed,
			&bal.UpdatedAt,
		)
		if err == nil {
			_, _ = b.db.Conn.Exec(`
				INSERT INTO public.credit_ledger (id, user_id, amount, type, description, reference_id, created_at)
				VALUES ($1, $2::uuid, $3, 'refund', $4, $5, NOW())
			`, fmt.Sprintf("led_%d", time.Now().UnixNano()), userID, amount, description, referenceID)

			b.mu.Lock()
			b.creditBalances[userID] = &bal
			b.mu.Unlock()
			return &bal, nil
		}
		if isProductionBilling() {
			return nil, errors.New("billing database unavailable")
		}
	}
	if isProductionBilling() {
		return nil, errors.New("billing database unavailable")
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	bal, exists := b.creditBalances[userID]
	if !exists {
		bal = &UserCreditBalance{
			UserID:            userID,
			Balance:           0,
			LifetimePurchased: 0,
			LifetimeUsed:      0,
			UpdatedAt:         now,
		}
		b.creditBalances[userID] = bal
	}

	bal.Balance += amount
	if bal.LifetimeUsed >= amount {
		bal.LifetimeUsed -= amount
	} else {
		bal.LifetimeUsed = 0
	}
	bal.UpdatedAt = now

	entry := CreditLedgerEntry{
		ID:          fmt.Sprintf("led_%d", time.Now().UnixNano()),
		UserID:      userID,
		Amount:      amount,
		Type:        "refund",
		Description: description,
		ReferenceID: referenceID,
		CreatedAt:   now,
	}
	b.creditLedger[userID] = append(b.creditLedger[userID], entry)

	copyBal := *bal
	return &copyBal, nil
}

// GetCreditLedger returns the transaction history for a user's credit balance
func (b *BillingService) GetCreditLedger(userID string) ([]CreditLedgerEntry, error) {
	if userID == "" {
		return nil, errors.New("user ID is required")
	}

	b.mu.RLock()
	entries, exists := b.creditLedger[userID]
	b.mu.RUnlock()

	if !exists {
		return []CreditLedgerEntry{}, nil
	}

	result := make([]CreditLedgerEntry, len(entries))
	copy(result, entries)
	return result, nil
}
