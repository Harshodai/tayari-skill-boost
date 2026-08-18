package api

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/capabilities"
)

type approvalNotifyRequest struct {
	Channel string `json:"channel"`
}

type notificationWebhookEvent struct {
	DeliveryID      string `json:"delivery_id"`
	ProviderEventID string `json:"provider_event_id"`
	EventType       string `json:"event_type"`
	Status          string `json:"status"`
}

func (s *Server) routesNotifications(r chi.Router) {
	r.Post("/api/notifications/email/webhook", s.handleEmailNotificationWebhook)
	r.Post("/api/v1/notifications/email/webhook", s.handleEmailNotificationWebhook)
	r.Get("/api/notifications/whatsapp/webhook", s.handleWhatsAppNotificationWebhook)
	r.Get("/api/v1/notifications/whatsapp/webhook", s.handleWhatsAppNotificationWebhook)
	r.Post("/api/notifications/whatsapp/webhook", s.handleWhatsAppNotificationWebhook)
	r.Post("/api/v1/notifications/whatsapp/webhook", s.handleWhatsAppNotificationWebhook)
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Post("/api/v1/approvals/{approvalID}/notify", s.handleNotifyApproval)
		r.Post("/api/approvals/{approvalID}/notify", s.handleNotifyApproval)
	})
}

func notificationReviewURL(approvalID uuid.UUID) string {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("APPROVAL_REVIEW_BASE_URL")), "/")
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
	}
	return base + "/approvals/" + approvalID.String()
}

func normalizeNotificationStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "accepted":
		return "accepted"
	case "sent":
		return "sent"
	case "delivered", "delivery":
		return "delivered"
	case "read":
		return "read"
	case "bounced", "bounce":
		return "bounced"
	case "complained", "complaint":
		return "complained"
	case "suppressed":
		return "suppressed"
	default:
		return "failed"
	}
}

func (s *Server) handleNotifyApproval(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceApprovals) {
		return
	}
	approvalID, err := uuid.Parse(chi.URLParam(r, "approvalID"))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid approval id")
		return
	}
	var request approvalNotifyRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 16*1024))
	if decoder.Decode(&request) != nil || (request.Channel != "email" && request.Channel != "whatsapp") {
		s.respondError(w, http.StatusBadRequest, "channel must be email or whatsapp")
		return
	}
	var summary, emailAddress, phoneE164, locale string
	var expiresAt time.Time
	var emailEnabled, whatsappEnabled, whatsappOptIn bool
	err = s.DB.Conn.QueryRowContext(r.Context(), `SELECT a.summary,a.token_expires_at,COALESCE(p.email_address,''),COALESCE(p.phone_e164,''),COALESCE(p.locale,'en'),COALESCE(p.email_enabled,false),COALESCE(p.whatsapp_enabled,false),COALESCE(p.whatsapp_opt_in_at IS NOT NULL AND p.whatsapp_opt_out_at IS NULL,false) FROM approval_requests a LEFT JOIN notification_preferences p ON p.tenant_id=a.tenant_id AND p.user_id=a.user_id WHERE a.id=$1 AND a.tenant_id=$2 AND a.user_id=$3 AND a.status IN ('pending','delivered','viewed')`, approvalID, tenantID, userID).Scan(&summary, &expiresAt, &emailAddress, &phoneE164, &locale, &emailEnabled, &whatsappEnabled, &whatsappOptIn)
	if err != nil || time.Now().After(expiresAt) {
		s.respondError(w, http.StatusConflict, "approval is missing or expired")
		return
	}
	var provider approvalNotificationProvider
	var recipient string
	switch request.Channel {
	case "email":
		if !emailEnabled || emailAddress == "" {
			s.respondError(w, http.StatusPreconditionFailed, "email notifications are not enabled or verified")
			return
		}
		if !s.requireCapability(w, capabilities.WorkspaceNotificationEmail) {
			return
		}
		provider = newGenericEmailProvider()
		recipient = emailAddress
	case "whatsapp":
		if !whatsappEnabled || !whatsappOptIn || phoneE164 == "" {
			s.respondError(w, http.StatusPreconditionFailed, "WhatsApp requires explicit opt-in and a verified phone number")
			return
		}
		if !s.requireCapability(w, capabilities.WorkspaceNotificationWhatsApp) {
			return
		}
		provider = newMetaWhatsAppProvider()
		recipient = phoneE164
	}
	if !provider.Configured() {
		s.respondError(w, http.StatusServiceUnavailable, provider.Name()+" is not configured")
		return
	}
	idempotencyKey := approvalID.String() + ":" + request.Channel
	_, err = s.DB.Conn.ExecContext(r.Context(), `INSERT INTO notification_deliveries (approval_id,tenant_id,user_id,channel,provider,status,idempotency_key,attempt_count,redacted_subject) VALUES ($1,$2,$3,$4,$5,'pending',$6,1,$7) ON CONFLICT (approval_id,channel) DO UPDATE SET attempt_count=notification_deliveries.attempt_count+1, status='pending', updated_at=now()`, approvalID, tenantID, userID, request.Channel, provider.Name(), idempotencyKey, "JobTayari approval required")
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to create notification delivery")
		return
	}
	messageID, sendErr := provider.Send(r.Context(), approvalNotification{ApprovalID: approvalID.String(), Recipient: recipient, Summary: summary, ReviewURL: notificationReviewURL(approvalID), ExpiresAt: expiresAt, Locale: locale, IdempotencyKey: idempotencyKey})
	if sendErr != nil {
		_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE notification_deliveries SET status='failed', last_error=$1, updated_at=now() WHERE approval_id=$2 AND channel=$3 AND tenant_id=$4 AND user_id=$5`, sendErr.Error(), approvalID, request.Channel, tenantID, userID)
		s.respondError(w, http.StatusBadGateway, "notification provider delivery failed")
		return
	}
	_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE notification_deliveries SET status='accepted', provider_message_id=$1, sent_at=now(), updated_at=now() WHERE approval_id=$2 AND channel=$3 AND tenant_id=$4 AND user_id=$5`, messageID, approvalID, request.Channel, tenantID, userID)
	_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE approval_requests SET status='delivered', updated_at=now() WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='pending'`, approvalID, tenantID, userID)
	s.respondJSON(w, http.StatusAccepted, map[string]any{"ok": true, "approval_id": approvalID, "channel": request.Channel, "provider": provider.Name(), "provider_message_id": messageID, "delivery_status": "accepted"})
}

func (s *Server) handleNotificationWebhook(w http.ResponseWriter, r *http.Request, provider string, secret string) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 256*1024))
	if err != nil || len(body) == 0 {
		s.respondError(w, http.StatusBadRequest, "invalid webhook body")
		return
	}
	signature := r.Header.Get("X-Notification-Signature")
	if provider == "meta_whatsapp" {
		signature = r.Header.Get("X-Hub-Signature-256")
	}
	if !webhookHMACValid(secret, body, signature) {
		s.respondError(w, http.StatusUnauthorized, "invalid webhook signature")
		return
	}
	var event notificationWebhookEvent
	if json.Unmarshal(body, &event) != nil || strings.TrimSpace(event.DeliveryID) == "" || strings.TrimSpace(event.ProviderEventID) == "" {
		s.respondError(w, http.StatusBadRequest, "invalid notification event")
		return
	}
	status := normalizeNotificationStatus(event.Status)
	if event.EventType != "" && event.Status == "" {
		status = normalizeNotificationStatus(event.EventType)
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	var deliveryID, tenantID, userID uuid.UUID
	err = s.DB.Conn.QueryRowContext(r.Context(), `SELECT id,tenant_id,user_id FROM notification_deliveries WHERE id=$1 AND provider=$2`, event.DeliveryID, provider).Scan(&deliveryID, &tenantID, &userID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "notification delivery not found")
		return
	}
	var insertedEventID uuid.UUID
	err = s.DB.Conn.QueryRowContext(r.Context(), `INSERT INTO notification_events (delivery_id,tenant_id,user_id,provider_event_id,event_type,payload) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`, deliveryID, tenantID, userID, event.ProviderEventID, event.EventType, body).Scan(&insertedEventID)
	if err == sql.ErrNoRows {
		s.respondJSON(w, http.StatusOK, map[string]any{"ok": true, "provider": provider, "delivery_id": deliveryID, "status": "duplicate_ignored"})
		return
	}
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to record notification event")
		return
	}
	_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE notification_deliveries SET status=$1, delivered_at=CASE WHEN $1 IN ('delivered','read') THEN now() ELSE delivered_at END, updated_at=now() WHERE id=$2`, status, deliveryID)
	s.respondJSON(w, http.StatusOK, map[string]any{"ok": true, "provider": provider, "delivery_id": deliveryID, "status": status, "event_id": insertedEventID})
}

func (s *Server) handleEmailNotificationWebhook(w http.ResponseWriter, r *http.Request) {
	s.handleNotificationWebhook(w, r, "transactional_email", os.Getenv("APPROVAL_EMAIL_WEBHOOK_SECRET"))
}

func (s *Server) handleWhatsAppNotificationWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		verifyToken := strings.TrimSpace(os.Getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"))
		if verifyToken != "" && subtle.ConstantTimeCompare([]byte(verifyToken), []byte(r.URL.Query().Get("hub.verify_token"))) == 1 {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(r.URL.Query().Get("hub.challenge")))
			return
		}
		s.respondError(w, http.StatusUnauthorized, "invalid WhatsApp webhook verification")
		return
	}
	s.handleNotificationWebhook(w, r, "meta_whatsapp", os.Getenv("WHATSAPP_APP_SECRET"))
}
