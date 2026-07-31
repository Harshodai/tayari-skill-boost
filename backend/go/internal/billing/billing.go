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

type BillingService struct {
	db              *database.DB
	mu              sync.RWMutex
	entitlements    map[string]*Entitlement
	processedEvents map[string]time.Time
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
	}
}

// IsBillingEnabled checks env kill-switch (default false for self-hosters)
func IsBillingEnabled() bool {
	return os.Getenv("BILLING_ENABLED") == "true"
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
			// A transient DB error (timeout, connection drop, etc.) is not
			// the same as "no subscription row exists" — log it distinctly
			// so it isn't confused with a genuinely free/no-subscription
			// user. Falls through to the in-memory cache below, which may
			// still hold this user's entitlement from a prior webhook.
			log.Printf("[billing] GetEntitlement: DB query failed for user %s (falling back to cache/free): %v", userID, err)
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
	"resume_optimize":    TierFree,
	"ats_score":          TierFree,
	"cover_letter":       TierFree,
	"job_search":         TierFree,
	"save_job":           TierFree,
	"knowledge_graph":    TierFree,
	"dashboard_stats":    TierFree,
	// Pro-only features
	"interview_copilot":  TierPro,
	"voice_coach":        TierPro,
	"deep_ats":           TierPro,
	"agent_reach":        TierPro,
	"autopilot":          TierPro,
	"recruiter_lookup":   TierPro,
	"offer_calculate":    TierPro,
	"linkedin_analyze":   TierPro,
	"truth_check":        TierPro,
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
	// Match by substring the same way ProcessStripeWebhook already does
	// when computing metered limits, so a paying customer with a variant
	// plan string isn't silently ranked the same as free (rank 0).
	if strings.Contains(p, "enterprise") || strings.Contains(p, "team") {
		return 2
	}
	if strings.Contains(p, "pro") {
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
		return true, "" // unknown feature: allow by default (fail open)
	}
	ent := b.GetEntitlement(userID)
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

// CreateCheckoutSession initiates a live Stripe Checkout flow
func (b *BillingService) CreateCheckoutSession(userID, userEmail, plan, returnURL string) (string, error) {
	if stripe.Key == "" {
		return "", errors.New("stripe API key is not configured on server")
	}

	priceID := os.Getenv("STRIPE_PRICE_PRO_ID")
	if strings.ToLower(plan) == "enterprise" || strings.ToLower(plan) == "team" {
		if id := os.Getenv("STRIPE_PRICE_ENTERPRISE_ID"); id != "" {
			priceID = id
		}
	}
	if priceID == "" {
		// Fallback for dev mode
		priceID = "price_pro_default"
	}

	successURL := returnURL + "?session_id={CHECKOUT_SESSION_ID}&billing=success"
	cancelURL := returnURL + "?billing=cancel"

	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		Mode:               stripe.String(string(stripe.CheckoutSessionModeSubscription)),
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
	params.AddMetadata("plan", plan)

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

// ProcessStripeWebhook processes subscription events idempotently with Postgres update
func (b *BillingService) ProcessStripeWebhook(eventID, eventType, customerID, subscriptionID, userID, plan string) bool {
	if !IsBillingEnabled() {
		return true
	}

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
	b.mu.Unlock()

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

	// Persist to PostgreSQL if available
	if b.db != nil && b.db.Conn != nil && userID != "" {
		_, err := b.db.Conn.Exec(`
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
			log.Printf("[billing] Failed to save subscription to DB: %v", err)
		}
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
