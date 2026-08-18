package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestApprovalNotificationProvidersFailClosedWhenUnconfigured(t *testing.T) {
	for _, key := range []string{"APPROVAL_EMAIL_ENDPOINT", "APPROVAL_EMAIL_API_KEY", "APPROVAL_EMAIL_FROM", "WHATSAPP_GRAPH_API_BASE_URL", "WHATSAPP_GRAPH_API_VERSION", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APPROVAL_TEMPLATE_NAME"} {
		t.Setenv(key, "")
	}
	if newGenericEmailProvider().Configured() {
		t.Fatal("email provider must be unconfigured without complete settings")
	}
	if newMetaWhatsAppProvider().Configured() {
		t.Fatal("WhatsApp provider must be unconfigured without complete settings")
	}
}

func TestWebhookHMACValidatesExactBody(t *testing.T) {
	secret := "test-webhook-secret"
	body := []byte(`{"delivery_id":"d1"}`)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !webhookHMACValid(secret, body, signature) {
		t.Fatal("expected valid webhook signature")
	}
	if webhookHMACValid(secret, []byte(`{"delivery_id":"d2"}`), signature) {
		t.Fatal("changed webhook body must fail signature validation")
	}
	if webhookHMACValid(secret, body, "sha256=wrong") {
		t.Fatal("wrong webhook signature must fail")
	}
}
