package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/billing"
)

func (s *Server) RegisterBillingRoutes(r chi.Router, b *billing.BillingService) {
	// Protected Billing Status, Checkout & Portal Creation
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(s.authRateLimiter.Middleware)

		r.Get("/api/v1/billing/status", s.handleBillingStatus(b))
		r.Get("/api/billing/status", s.handleBillingStatus(b))
		r.Post("/api/v1/billing/create-checkout-session", s.handleCreateCheckoutSession(b))
		r.Post("/api/billing/create-checkout-session", s.handleCreateCheckoutSession(b))
		r.Post("/api/v1/billing/create-portal-session", s.handleCreatePortalSession(b))
		r.Post("/api/billing/create-portal-session", s.handleCreatePortalSession(b))
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
