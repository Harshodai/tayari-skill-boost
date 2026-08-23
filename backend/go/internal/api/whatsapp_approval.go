package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"tayari-backend/internal/capabilities"
)

const whatsappApprovalPayloadPrefix = "tayari.approval.v1:"

var e164PhonePattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)

type whatsappWebhookEnvelope struct {
	Object string                 `json:"object"`
	Entry  []whatsappWebhookEntry `json:"entry"`
}

type whatsappWebhookEntry struct {
	Changes []whatsappWebhookChange `json:"changes"`
}

type whatsappWebhookChange struct {
	Field string               `json:"field"`
	Value whatsappWebhookValue `json:"value"`
}

type whatsappWebhookValue struct {
	MessagingProduct string                   `json:"messaging_product"`
	Metadata         whatsappWebhookMetadata  `json:"metadata"`
	Contacts         []whatsappWebhookContact `json:"contacts"`
	Messages         []whatsappInboundMessage `json:"messages"`
	Statuses         []whatsappStatusEvent    `json:"statuses"`
}

type whatsappWebhookMetadata struct {
	PhoneNumberID string `json:"phone_number_id"`
}

type whatsappWebhookContact struct {
	WAID string `json:"wa_id"`
}

type whatsappInboundMessage struct {
	ID        string `json:"id"`
	From      string `json:"from"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`
	Context   struct {
		ID string `json:"id"`
	} `json:"context"`
	Interactive *struct {
		Type        string `json:"type"`
		ButtonReply *struct {
			ID    string `json:"id"`
			Title string `json:"title"`
		} `json:"button_reply"`
	} `json:"interactive"`
	Button *struct {
		Payload string `json:"payload"`
		Text    string `json:"text"`
	} `json:"button"`
}

type whatsappStatusEvent struct {
	ID        string          `json:"id"`
	Status    string          `json:"status"`
	Timestamp string          `json:"timestamp"`
	Recipient string          `json:"recipient_id"`
	Errors    json.RawMessage `json:"errors,omitempty"`
}

func approvalSigningKey() string {
	return strings.TrimSpace(os.Getenv("APPROVAL_SIGNING_KEY"))
}

func whatsappApprovalButtonPayload(approvalID, decision string) string {
	key := approvalSigningKey()
	approvalID = strings.TrimSpace(approvalID)
	decision = strings.TrimSpace(decision)
	if key == "" || approvalID == "" || (decision != "approve" && decision != "deny") {
		return ""
	}
	data := approvalID + "\x00" + decision
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte(data))
	return whatsappApprovalPayloadPrefix + base64.RawURLEncoding.EncodeToString([]byte(data)) + "." + hex.EncodeToString(mac.Sum(nil))
}

func parseWhatsAppApprovalButtonPayload(payload string) (uuid.UUID, string, bool) {
	key := approvalSigningKey()
	if key == "" || !strings.HasPrefix(payload, whatsappApprovalPayloadPrefix) {
		return uuid.Nil, "", false
	}
	parts := strings.Split(strings.TrimPrefix(payload, whatsappApprovalPayloadPrefix), ".")
	if len(parts) != 2 {
		return uuid.Nil, "", false
	}
	data, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return uuid.Nil, "", false
	}
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write(data)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(strings.ToLower(parts[1])), []byte(expected)) {
		return uuid.Nil, "", false
	}
	values := strings.Split(string(data), "\x00")
	if len(values) != 2 || (values[1] != "approve" && values[1] != "deny") {
		return uuid.Nil, "", false
	}
	approvalID, err := uuid.Parse(values[0])
	if err != nil {
		return uuid.Nil, "", false
	}
	return approvalID, values[1], true
}

func whatsappButtonPayload(message whatsappInboundMessage) string {
	if message.Interactive != nil && message.Interactive.ButtonReply != nil && message.Interactive.Type == "button_reply" {
		return strings.TrimSpace(message.Interactive.ButtonReply.ID)
	}
	if message.Button != nil {
		return strings.TrimSpace(message.Button.Payload)
	}
	return ""
}

func validWhatsAppPhoneE164(value string) bool {
	return e164PhonePattern.MatchString(strings.TrimSpace(value))
}

func configuredWhatsAppPhoneNumberID() string {
	return strings.TrimSpace(os.Getenv("WHATSAPP_PHONE_NUMBER_ID"))
}

func normalizeWhatsAppStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "accepted":
		return "accepted"
	case "sent":
		return "sent"
	case "delivered":
		return "delivered"
	case "read":
		return "read"
	case "failed":
		return "failed"
	default:
		return "failed"
	}
}

func whatsappStatusEventID(event whatsappStatusEvent) string {
	return "whatsapp-status:" + strings.TrimSpace(event.ID) + ":" + strings.TrimSpace(event.Status) + ":" + strings.TrimSpace(event.Timestamp)
}

func (s *Server) handleWhatsAppWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		verifyToken := strings.TrimSpace(os.Getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"))
		challenge := r.URL.Query().Get("hub.challenge")
		if r.URL.Query().Get("hub.mode") == "subscribe" && verifyToken != "" && challenge != "" && subtleConstantTimeCompare(verifyToken, r.URL.Query().Get("hub.verify_token")) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(challenge))
			return
		}
		s.respondError(w, http.StatusUnauthorized, "invalid WhatsApp webhook verification")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 512*1024))
	signature := r.Header.Get("X-Hub-Signature-256")
	if err != nil || len(body) == 0 || !strings.HasPrefix(signature, "sha256=") || !webhookHMACValid(os.Getenv("WHATSAPP_APP_SECRET"), body, signature) {
		s.respondError(w, http.StatusUnauthorized, "invalid WhatsApp webhook signature")
		return
	}
	var envelope whatsappWebhookEnvelope
	if json.Unmarshal(body, &envelope) != nil || envelope.Object != "whatsapp_business_account" || len(envelope.Entry) == 0 {
		s.respondError(w, http.StatusBadRequest, "invalid WhatsApp webhook event")
		return
	}
	for _, entry := range envelope.Entry {
		for _, change := range entry.Changes {
			if change.Field != "messages" || change.Value.MessagingProduct != "whatsapp" || configuredWhatsAppPhoneNumberID() == "" || change.Value.Metadata.PhoneNumberID != configuredWhatsAppPhoneNumberID() {
				continue
			}
			for _, status := range change.Value.Statuses {
				if err := s.recordWhatsAppStatus(r, status); err != nil && err != sql.ErrNoRows {
					s.respondError(w, http.StatusServiceUnavailable, "failed to record WhatsApp delivery status")
					return
				}
			}
			if s.capabilities == nil || !s.capabilities.Enabled(capabilities.WorkspaceNotificationWhatsApp) || !s.capabilities.Enabled(capabilities.WorkspaceApprovals) {
				continue
			}
			for _, message := range change.Value.Messages {
				waID := strings.TrimSpace(message.From)
				if waID == "" && len(change.Value.Contacts) > 0 {
					waID = strings.TrimSpace(change.Value.Contacts[0].WAID)
				}
				if waID == "" {
					continue
				}
				if err := s.handleWhatsAppInboundApproval(r, message, waID); err != nil {
					// Invalid, expired, already-consumed, or unmapped button replies are
					// acknowledged so Meta does not retry an event that cannot become valid.
					continue
				}
			}
		}
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func subtleConstantTimeCompare(left, right string) bool {
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}

func (s *Server) recordWhatsAppStatus(r *http.Request, event whatsappStatusEvent) error {
	if strings.TrimSpace(event.ID) == "" {
		return nil
	}
	status := normalizeWhatsAppStatus(event.Status)
	auditPayload, _ := json.Marshal(map[string]string{"message_id": event.ID, "status": status})
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var deliveryID, tenantID, userID uuid.UUID
	err = tx.QueryRowContext(r.Context(), `SELECT id,tenant_id,user_id FROM notification_deliveries WHERE provider='meta_whatsapp' AND channel='whatsapp' AND provider_message_id=$1 LIMIT 1`, event.ID).Scan(&deliveryID, &tenantID, &userID)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	result, err := tx.ExecContext(r.Context(), `INSERT INTO notification_events (delivery_id,tenant_id,user_id,provider_event_id,event_type,payload) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider_event_id) DO NOTHING`, deliveryID, tenantID, userID, whatsappStatusEventID(event), "whatsapp.delivery."+status, auditPayload)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return tx.Commit()
	}
	_, err = tx.ExecContext(r.Context(), `UPDATE notification_deliveries SET status=$1, delivered_at=CASE WHEN $1 IN ('delivered','read') THEN COALESCE(delivered_at,now()) ELSE delivered_at END, updated_at=now() WHERE id=$2`, status, deliveryID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Server) handleWhatsAppInboundApproval(r *http.Request, message whatsappInboundMessage, waID string) error {
	if strings.TrimSpace(message.ID) == "" || strings.TrimSpace(message.Type) == "" {
		return errors.New("invalid inbound WhatsApp message")
	}
	approvalID, buttonDecision, ok := parseWhatsAppApprovalButtonPayload(whatsappButtonPayload(message))
	if !ok {
		return errors.New("unrecognized WhatsApp approval button")
	}
	var tenantID, userID uuid.UUID
	err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT tenant_id,user_id FROM notification_preferences WHERE whatsapp_wa_id=$1 AND whatsapp_enabled=true AND whatsapp_opt_in_at IS NOT NULL AND whatsapp_opt_out_at IS NULL`, strings.TrimSpace(waID)).Scan(&tenantID, &userID)
	if err != nil {
		return err
	}
	decision := map[string]string{"approve": "approved", "deny": "denied"}[buttonDecision]
	auditPayload, _ := json.Marshal(map[string]string{"message_id": message.ID, "button_version": "tayari.approval.v1", "decision": decision})
	return s.applyWhatsAppApprovalDecision(r, approvalID, tenantID, userID, decision, message.ID, auditPayload)
}

func (s *Server) applyWhatsAppApprovalDecision(r *http.Request, approvalID, tenantID, userID uuid.UUID, decision, providerEventID string, auditPayload []byte) error {
	if decision != "approved" && decision != "denied" {
		return errors.New("invalid WhatsApp approval decision")
	}
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var deliveryID uuid.UUID
	var runID *uuid.UUID
	var riskTier string
	var tokenExpiresAt time.Time
	if err := tx.QueryRowContext(r.Context(), `SELECT d.id,a.run_id,a.risk_tier,a.token_expires_at FROM notification_deliveries d JOIN approval_requests a ON a.id=d.approval_id JOIN notification_preferences p ON p.tenant_id=d.tenant_id AND p.user_id=d.user_id WHERE d.approval_id=$1 AND d.tenant_id=$2 AND d.user_id=$3 AND d.channel='whatsapp' AND d.provider='meta_whatsapp' AND p.whatsapp_wa_id IS NOT NULL AND a.status IN ('pending','delivered','viewed') FOR UPDATE OF d,a`, approvalID, tenantID, userID).Scan(&deliveryID, &runID, &riskTier, &tokenExpiresAt); err != nil {
		return fmt.Errorf("approval is missing or was not sent through WhatsApp: %w", err)
	}
	result, err := tx.ExecContext(r.Context(), `INSERT INTO notification_events (delivery_id,tenant_id,user_id,provider_event_id,event_type,payload) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider_event_id) DO NOTHING`, deliveryID, tenantID, userID, providerEventID, "whatsapp.approval_reply", auditPayload)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return tx.Commit()
	}
	if time.Now().After(tokenExpiresAt) {
		return tx.Commit()
	}
	if riskTier == "submission" {
		return tx.Commit()
	}
	result, err = tx.ExecContext(r.Context(), `UPDATE approval_requests SET status=$4, decision_channel='whatsapp', decided_at=now(), decided_by=NULL, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status IN ('pending','delivered','viewed')`, approvalID, tenantID, userID, decision)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return tx.Commit()
	}
	if runID != nil {
		runStatus := map[string]string{"approved": "resumed", "denied": "failed"}[decision]
		if _, err := tx.ExecContext(r.Context(), `UPDATE automation_runs SET status=$2, version=version+1, updated_at=now() WHERE id=$1 AND tenant_id=$3 AND user_id=$4`, *runID, runStatus, tenantID, userID); err != nil {
			return err
		}
		decisionPayload := []byte(fmt.Sprintf(`{"approval_id":%q,"decision":%q,"decision_channel":"whatsapp"}`, approvalID, decision))
		if err := writeAutomationEvent(r, tx, *runID, userID, tenantID, "automation.approval."+decision, decisionPayload); err != nil {
			return err
		}
		decisionEventID := uuid.NewSHA1(uuid.NameSpaceURL, []byte("tayari:approval:"+approvalID.String()+":"+decision+":whatsapp"))
		if err := writeAutomationInboxEvent(r, tx, decisionEventID, userID, tenantID, "automation.approval."+decision, "whatsapp.webhook", decisionPayload); err != nil {
			return err
		}
	}
	return tx.Commit()
}
