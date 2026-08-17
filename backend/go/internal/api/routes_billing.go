package api

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/billing"
)

func (s *Server) RegisterBillingRoutes(r chi.Router, b *billing.BillingService) {
	// Protected Billing Status, Checkout, Portal & Credit Operations
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(s.authRateLimiter.Middleware)

		r.Get("/api/v1/billing/status", s.handleBillingStatus(b))
		r.Get("/api/billing/status", s.handleBillingStatus(b))
		r.Post("/api/v1/billing/create-checkout-session", s.handleCreateCheckoutSession(b))
		r.Post("/api/billing/create-checkout-session", s.handleCreateCheckoutSession(b))
		r.Post("/api/v1/billing/create-portal-session", s.handleCreatePortalSession(b))
		r.Post("/api/billing/create-portal-session", s.handleCreatePortalSession(b))

		// Credit balances & purchases
		r.Get("/api/v1/billing/credits", s.handleGetCredits(b))
		r.Get("/api/billing/credits", s.handleGetCredits(b))
		r.Post("/api/v1/billing/credits/purchase", s.handlePurchaseCredits(b))
		r.Post("/api/billing/credits/purchase", s.handlePurchaseCredits(b))
	})

	// Public Credit Packs list
	r.Get("/api/v1/billing/credits/packs", s.handleGetCreditPacks(b))
	r.Get("/api/billing/credits/packs", s.handleGetCreditPacks(b))

	// Service/Client debit and refund endpoints. These mutate credit balances,
	// so they require either the shared internal-service token (trusted
	// server-to-server caller, e.g. the Python receipt pipeline) or a valid
	// user session — and a session may only affect its own user_id.
	r.Group(func(r chi.Router) {
		r.Use(s.internalOrAuthMiddleware)
		r.Post("/api/v1/billing/credits/debit", s.handleDebitCredits(b))
		r.Post("/api/billing/credits/debit", s.handleDebitCredits(b))
		r.Post("/api/v1/billing/credits/refund", s.handleRefundCredits(b))
		r.Post("/api/billing/credits/refund", s.handleRefundCredits(b))
	})

	// Public Webhook Endpoint (Stripe Signature Verified)
	r.Post("/api/v1/billing/webhook", s.handleStripeWebhook(b))
	r.Post("/api/billing/webhook", s.handleStripeWebhook(b))
}

func (s *Server) handleBillingStatus(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user == nil || user.ID == [16]byte{} {
			s.respondError(w, http.StatusUnauthorized, "unauthorized - valid authentication required")
			return
		}
		ent := b.GetEntitlement(user.ID.String())
		s.respondJSON(w, http.StatusOK, ent)
	}
}

func (s *Server) handleCreateCheckoutSession(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user == nil || user.ID == [16]byte{} {
			s.respondError(w, http.StatusUnauthorized, "unauthorized - valid authentication required")
			return
		}

		var req struct {
			Plan      string `json:"plan"`
			ReturnURL string `json:"return_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Plan == "" {
			req.Plan = "pro"
		}
		if req.ReturnURL == "" {
			req.ReturnURL = s.Config.FrontendURL + "/pricing"
		}

		url, err := b.CreateCheckoutSession(user.ID.String(), user.Email, req.Plan, req.ReturnURL)
		if err != nil {
			s.respondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		s.respondJSON(w, http.StatusOK, map[string]string{
			"url": url,
		})
	}
}

func (s *Server) handleCreatePortalSession(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user == nil || user.ID == [16]byte{} {
			s.respondError(w, http.StatusUnauthorized, "unauthorized - valid authentication required")
			return
		}

		var req struct {
			ReturnURL string `json:"return_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ReturnURL == "" {
			req.ReturnURL = s.Config.FrontendURL + "/settings"
		}

		url, err := b.CreatePortalSession(user.ID.String(), req.ReturnURL)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, err.Error())
			return
		}

		s.respondJSON(w, http.StatusOK, map[string]string{
			"url": url,
		})
	}
}

func (s *Server) handleStripeWebhook(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 65536)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid webhook payload")
			return
		}

		secret := os.Getenv("STRIPE_WEBHOOK_SECRET")
		if billing.IsBillingEnabled() && !billing.VerifyStripeSignature(body, r.Header.Get("Stripe-Signature"), secret) {
			s.respondError(w, http.StatusUnauthorized, "invalid stripe signature")
			return
		}

		var payload struct {
			ID   string `json:"id"`
			Type string `json:"type"`
			Data struct {
				Object struct {
					ID                string `json:"id"`
					Customer          string `json:"customer"`
					Subscription      string `json:"subscription"`
					ClientReferenceID string `json:"client_reference_id"`
					Metadata          struct {
						UserID string `json:"user_id"`
						Plan   string `json:"plan"`
					} `json:"metadata"`
					Plan struct {
						ID string `json:"id"`
					} `json:"plan"`
				} `json:"object"`
			} `json:"data"`
		}

		if err := json.Unmarshal(body, &payload); err != nil {
			s.respondError(w, http.StatusBadRequest, "malformed webhook json")
			return
		}

		userID := payload.Data.Object.Metadata.UserID
		if userID == "" {
			userID = payload.Data.Object.ClientReferenceID
		}

		plan := payload.Data.Object.Metadata.Plan
		if plan == "" {
			plan = payload.Data.Object.Plan.ID
		}

		customerID := payload.Data.Object.Customer
		subID := payload.Data.Object.Subscription
		if subID == "" {
			subID = payload.Data.Object.ID
		}

		b.ProcessStripeWebhook(payload.ID, payload.Type, customerID, subID, userID, plan)
		s.respondJSON(w, http.StatusOK, map[string]string{"status": "processed"})
	}
}

func (s *Server) handleGetCredits(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user == nil || user.ID == [16]byte{} {
			s.respondError(w, http.StatusUnauthorized, "unauthorized - valid authentication required")
			return
		}

		bal, err := b.GetCreditBalance(user.ID.String())
		if err != nil {
			s.respondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		s.respondJSON(w, http.StatusOK, bal)
	}
}

func (s *Server) handleGetCreditPacks(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		packs := b.GetCreditPacks()
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"packs": packs,
		})
	}
}

func (s *Server) handlePurchaseCredits(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user == nil || user.ID == [16]byte{} {
			s.respondError(w, http.StatusUnauthorized, "unauthorized - valid authentication required")
			return
		}

		var req struct {
			PackID      string `json:"pack_id"`
			Amount      int    `json:"amount"`
			ReferenceID string `json:"reference_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		var bal *billing.UserCreditBalance
		var err error

		if req.PackID != "" {
			bal, err = b.PurchaseCreditPack(user.ID.String(), req.PackID, req.ReferenceID)
		} else if req.Amount > 0 {
			bal, err = b.AddCredits(user.ID.String(), req.Amount, req.ReferenceID, "Direct credit purchase")
		} else {
			s.respondError(w, http.StatusBadRequest, "pack_id or positive amount required")
			return
		}

		if err != nil {
			s.respondError(w, http.StatusBadRequest, err.Error())
			return
		}

		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "success",
			"balance": bal,
		})
	}
}

// internalServiceCaller reports whether the request carries the shared
// AI_INTERNAL_TOKEN, compared in constant time (same pattern as /metrics).
func (s *Server) internalServiceCaller(r *http.Request) bool {
	expected := os.Getenv("AI_INTERNAL_TOKEN")
	if expected == "" && s.Config != nil {
		expected = s.Config.AIInternalToken
	}
	if expected == "" {
		return false
	}
	provided := r.Header.Get("X-Internal-Token")
	if provided == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

// internalOrAuthMiddleware lets a verified internal-service caller through
// untouched and otherwise enforces the normal user authentication middleware,
// so these routes are never reachable anonymously.
func (s *Server) internalOrAuthMiddleware(next http.Handler) http.Handler {
	authed := s.authMiddleware(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.internalServiceCaller(r) {
			next.ServeHTTP(w, r)
			return
		}
		authed.ServeHTTP(w, r)
	})
}

// resolveCreditSubject determines which user a credit mutation may target.
// Internal callers may name any user_id; everyone else must be authenticated
// and can only affect themselves. Returns "" after writing an error response.
func (s *Server) resolveCreditSubject(w http.ResponseWriter, r *http.Request, bodyUserID string) string {
	if s.internalServiceCaller(r) {
		if bodyUserID == "" {
			s.respondError(w, http.StatusBadRequest, "user_id is required")
			return ""
		}
		return bodyUserID
	}

	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == [16]byte{} {
		s.respondError(w, http.StatusUnauthorized, "unauthorized - valid authentication required")
		return ""
	}
	self := user.ID.String()
	if bodyUserID != "" && !strings.EqualFold(bodyUserID, self) {
		s.respondError(w, http.StatusForbidden, "forbidden - cannot modify another user's credits")
		return ""
	}
	return self
}

func (s *Server) handleDebitCredits(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID      string `json:"user_id"`
			Amount      int    `json:"amount"`
			ReferenceID string `json:"reference_id"`
			Description string `json:"description"`
			Verified    *bool  `json:"verified"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		userID := s.resolveCreditSubject(w, r, req.UserID)
		if userID == "" {
			return
		}

		// If explicitly marked as unverified/failed, 0 charge
		if req.Verified != nil && !*req.Verified {
			bal, _ := b.GetCreditBalance(userID)
			s.respondJSON(w, http.StatusOK, map[string]interface{}{
				"status":  "no_charge",
				"debited": 0,
				"balance": bal,
				"message": "unverified or failed submissions are not charged",
			})
			return
		}

		amount := req.Amount
		if amount <= 0 {
			amount = 1
		}

		desc := req.Description
		if desc == "" {
			desc = "Verified submission debit"
		}

		success, bal, err := b.DebitCredit(userID, amount, req.ReferenceID, desc)
		if !success || err != nil {
			s.respondJSON(w, http.StatusPaymentRequired, map[string]interface{}{
				"error":   "insufficient credit balance - purchase a credit pack at /pricing",
				"status":  "insufficient_credits",
				"balance": bal,
			})
			return
		}

		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "success",
			"debited": amount,
			"balance": bal,
		})
	}
}

func (s *Server) handleRefundCredits(b *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID      string `json:"user_id"`
			Amount      int    `json:"amount"`
			ReferenceID string `json:"reference_id"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		userID := s.resolveCreditSubject(w, r, req.UserID)
		if userID == "" {
			return
		}

		amount := req.Amount
		if amount <= 0 {
			amount = 1
		}

		desc := req.Description
		if desc == "" {
			desc = "Submission credit refund"
		}

		bal, err := b.RefundCredit(userID, amount, req.ReferenceID, desc)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, err.Error())
			return
		}

		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":   "success",
			"refunded": amount,
			"balance":  bal,
		})
	}
}
