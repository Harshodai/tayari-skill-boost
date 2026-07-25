package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"tayari-backend/internal/auth"
)

// Entitlement represents a user's subscription tier & capabilities
type Entitlement struct {
	UserID       string    `json:"user_id"`
	Plan         string    `json:"plan"` // "free" | "pro" | "enterprise"
	IsActive     bool      `json:"is_active"`
	MeteredLimit int       `json:"metered_limit"`
	RequestsUsed int       `json:"requests_used"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type BillingService struct {
	mu              sync.RWMutex
	entitlements    map[string]*Entitlement
	processedEvents map[string]time.Time
}

func NewBillingService() *BillingService {
	return &BillingService{
		entitlements:    make(map[string]*Entitlement),
		processedEvents: make(map[string]time.Time),
	}
}

// IsBillingEnabled checks env kill-switch (default false for self-hosters)
func IsBillingEnabled() bool {
	return os.Getenv("BILLING_ENABLED") == "true"
}

func (b *BillingService) GetEntitlement(userID string) *Entitlement {
	b.mu.RLock()
	defer b.mu.RUnlock()

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

	ent, exists := b.entitlements[userID]
	if !exists {
		return &Entitlement{
			UserID:       userID,
			Plan:         "free",
			IsActive:     true,
			MeteredLimit: 1000,
			RequestsUsed: 0,
		}
	}
	copyEnt := *ent
	return &copyEnt
}

func (b *BillingService) RecordUsage(userID string, count int) (bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if !IsBillingEnabled() {
		return true, nil
	}

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

// ProcessStripeWebhook processes subscription events idempotently
func (b *BillingService) ProcessStripeWebhook(eventID, eventType, userID, plan string) bool {
	if !IsBillingEnabled() {
		return true
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	// Evict entries older than 24h
	now := time.Now()
	for id, t := range b.processedEvents {
		if now.Sub(t) > 24*time.Hour {
			delete(b.processedEvents, id)
		}
	}

	// Webhook idempotency: skip processed event IDs
	if _, exists := b.processedEvents[eventID]; exists {
		return true
	}
	b.processedEvents[eventID] = now

	limit := 1000
	p := strings.ToLower(plan)
	if strings.Contains(p, "pro") || p == "price_pro" {
		limit = 50000
	} else if strings.Contains(p, "enterprise") || p == "price_enterprise" {
		limit = 1000000
	}

	b.entitlements[userID] = &Entitlement{
		UserID:       userID,
		Plan:         plan,
		IsActive:     eventType != "customer.subscription.deleted",
		MeteredLimit: limit,
		RequestsUsed: 0,
		ExpiresAt:    time.Now().AddDate(0, 1, 0),
	}
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

	// 5-minute (300 seconds) tolerance window for stale or future timestamps
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
			json.NewEncoder(w).Encode(map[string]string{
				"error": "unauthorized - valid authentication required",
			})
			return
		}
		userID := user.ID.String()

		allowed, err := b.RecordUsage(userID, 1)
		if !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "rate limit / token quota exceeded",
				"fix":   err.Error(),
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}
