package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"tayari-backend/internal/capabilities"
)

type whatsappLinkRequest struct {
	PhoneE164 string `json:"phone_e164"`
	Consent   bool   `json:"consent"`
}

type whatsappLinkConfirmRequest struct {
	Code string `json:"code"`
}

func randomWhatsAppLinkCode() (string, string, error) {
	value, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", "", err
	}
	code := fmt.Sprintf("%06d", value.Int64())
	digest := sha256.Sum256([]byte(code))
	return code, hex.EncodeToString(digest[:]), nil
}

func validWhatsAppLinkCode(code string) bool {
	if len(code) != 6 {
		return false
	}
	for _, char := range code {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

func maskWhatsAppPhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if len(phone) < 4 {
		return "***"
	}
	return strings.Repeat("*", len(phone)-4) + phone[len(phone)-4:]
}

func (s *Server) handleStartWhatsAppLink(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.requireCapability(w, capabilities.WorkspaceNotificationWhatsApp) {
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	var req whatsappLinkRequest
	if err := decodeAutomationJSON(r, &req); err != nil || !req.Consent || !validWhatsAppPhoneE164(req.PhoneE164) {
		s.respondError(w, http.StatusBadRequest, "valid E.164 phone number and explicit WhatsApp consent are required")
		return
	}
	provider := newMetaWhatsAppProvider()
	if !provider.LinkConfigured() {
		s.respondError(w, http.StatusServiceUnavailable, "WhatsApp linking provider is not configured")
		return
	}
	code, digest, err := randomWhatsAppLinkCode()
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to create WhatsApp link challenge")
		return
	}
	expiresAt := time.Now().Add(10 * time.Minute)
	_, err = s.DB.Conn.ExecContext(r.Context(), `INSERT INTO notification_preferences (tenant_id,user_id,phone_e164,whatsapp_enabled,whatsapp_opt_in_at,whatsapp_opt_out_at,whatsapp_wa_id,whatsapp_verified_at,whatsapp_link_code_digest,whatsapp_link_code_expires_at,whatsapp_link_attempts,locale,quiet_hours,fallback_order) VALUES ($1,$2,$3,false,NULL,now(),NULL,NULL,$4,$5,0,'en','{}'::jsonb,'["in_app"]'::jsonb) ON CONFLICT (tenant_id,user_id) DO UPDATE SET phone_e164=$3,whatsapp_enabled=false,whatsapp_opt_in_at=NULL,whatsapp_opt_out_at=now(),whatsapp_wa_id=NULL,whatsapp_verified_at=NULL,whatsapp_link_code_digest=$4,whatsapp_link_code_expires_at=$5,whatsapp_link_attempts=0,updated_at=now()`, tenantID, userID, strings.TrimSpace(req.PhoneE164), digest, expiresAt)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to store WhatsApp link challenge")
		return
	}
	result, sendErr := provider.SendLinkCode(r.Context(), strings.TrimSpace(req.PhoneE164), code)
	if sendErr != nil || strings.TrimSpace(result.RecipientWAID) == "" {
		_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE notification_preferences SET whatsapp_link_code_digest=NULL,whatsapp_link_code_expires_at=NULL,whatsapp_link_attempts=0,updated_at=now() WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
		if sendErr != nil {
			s.respondError(w, http.StatusBadGateway, "WhatsApp link message could not be sent")
		} else {
			s.respondError(w, http.StatusBadGateway, "WhatsApp provider did not return a recipient identity")
		}
		return
	}
	_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE notification_preferences SET whatsapp_wa_id=$1,updated_at=now() WHERE tenant_id=$2 AND user_id=$3`, result.RecipientWAID, tenantID, userID)
	s.respondJSON(w, http.StatusAccepted, map[string]any{"ok": true, "phone_e164": maskWhatsAppPhone(req.PhoneE164), "expires_at": expiresAt, "provider_message_id": result.ProviderMessageID, "next": "Enter the six-digit code received on WhatsApp to finish linking."})
}

func (s *Server) handleConfirmWhatsAppLink(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.requireCapability(w, capabilities.WorkspaceNotificationWhatsApp) {
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	var req whatsappLinkConfirmRequest
	if err := decodeAutomationJSON(r, &req); err != nil || !validWhatsAppLinkCode(strings.TrimSpace(req.Code)) {
		s.respondError(w, http.StatusBadRequest, "code must be six digits")
		return
	}
	codeDigest := sha256.Sum256([]byte(strings.TrimSpace(req.Code)))
	digest := hex.EncodeToString(codeDigest[:])
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to verify WhatsApp link")
		return
	}
	defer tx.Rollback()
	var storedDigest string
	var expiresAt sql.NullTime
	var attempts int
	var waID string
	err = tx.QueryRowContext(r.Context(), `SELECT whatsapp_link_code_digest,whatsapp_link_code_expires_at,whatsapp_link_attempts,COALESCE(whatsapp_wa_id,'') FROM notification_preferences WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`, tenantID, userID).Scan(&storedDigest, &expiresAt, &attempts, &waID)
	if err != nil || !expiresAt.Valid || time.Now().After(expiresAt.Time) || attempts >= 5 || waID == "" {
		s.respondError(w, http.StatusConflict, "WhatsApp link challenge is missing or expired")
		return
	}
	if !strings.EqualFold(storedDigest, digest) {
		_, _ = tx.ExecContext(r.Context(), `UPDATE notification_preferences SET whatsapp_link_attempts=whatsapp_link_attempts+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID)
		_ = tx.Commit()
		s.respondError(w, http.StatusConflict, "WhatsApp link code is invalid")
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE notification_preferences SET whatsapp_enabled=true,whatsapp_opt_in_at=now(),whatsapp_opt_out_at=NULL,whatsapp_verified_at=now(),whatsapp_link_code_digest=NULL,whatsapp_link_code_expires_at=NULL,whatsapp_link_attempts=0,updated_at=now() WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to activate WhatsApp approvals")
		return
	}
	if err := tx.Commit(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to commit WhatsApp link")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"ok": true, "whatsapp_enabled": true, "whatsapp_opt_in": true})
}
