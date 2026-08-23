package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestWhatsAppApprovalButtonPayloadIsSignedAndBound(t *testing.T) {
	t.Setenv("APPROVAL_SIGNING_KEY", "test-approval-signing-key")
	approvalID := uuid.New()
	payload := whatsappApprovalButtonPayload(approvalID.String(), "approve")
	gotID, gotDecision, ok := parseWhatsAppApprovalButtonPayload(payload)
	if !ok || gotID != approvalID || gotDecision != "approve" {
		t.Fatalf("expected signed approve payload to round-trip, got %q %s %v", payload, gotID, ok)
	}
	if _, _, ok := parseWhatsAppApprovalButtonPayload(payload + "x"); ok {
		t.Fatal("tampered payload must be rejected")
	}
	if _, _, ok := parseWhatsAppApprovalButtonPayload(whatsappApprovalButtonPayload(approvalID.String(), "submit")); ok {
		t.Fatal("unsupported decision must not produce a payload")
	}
}

func TestWhatsAppApprovalButtonPayloadFailsClosedWithoutSigningKey(t *testing.T) {
	t.Setenv("APPROVAL_SIGNING_KEY", "")
	if payload := whatsappApprovalButtonPayload(uuid.NewString(), "approve"); payload != "" {
		t.Fatalf("expected no payload without signing key, got %q", payload)
	}
}

func TestWhatsAppPhoneValidationRequiresE164(t *testing.T) {
	for _, value := range []string{"+14155552671", "+919876543210"} {
		if !validWhatsAppPhoneE164(value) {
			t.Fatalf("expected valid E.164 number: %s", value)
		}
	}
	for _, value := range []string{"14155552671", "+1 415 555 2671", "+123", "+1234567890123456", "javascript:+14155552671"} {
		if validWhatsAppPhoneE164(value) {
			t.Fatalf("expected invalid E.164 number: %s", value)
		}
	}
}

func TestWhatsAppInboundButtonPayloadOnlyAcceptsInteractiveReply(t *testing.T) {
	buttonID := "tayari.approval.v1:opaque"
	message := whatsappInboundMessage{Type: "interactive"}
	message.Interactive = &struct {
		Type        string `json:"type"`
		ButtonReply *struct {
			ID    string `json:"id"`
			Title string `json:"title"`
		} `json:"button_reply"`
	}{Type: "button_reply", ButtonReply: &struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}{ID: buttonID, Title: "Approve"}}
	if got := whatsappButtonPayload(message); got != buttonID {
		t.Fatalf("expected button id %q, got %q", buttonID, got)
	}
	freeform := whatsappInboundMessage{Type: "text"}
	if got := whatsappButtonPayload(freeform); got != "" {
		t.Fatalf("free-form text must not become an approval payload: %q", got)
	}
}

func TestWhatsAppWebhookVerificationRequiresSubscribeModeAndExactToken(t *testing.T) {
	t.Setenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "verify-token")
	server := &Server{}
	requestURL := "/api/v1/notifications/whatsapp/webhook?" + url.Values{"hub.mode": {"subscribe"}, "hub.challenge": {"challenge-123"}, "hub.verify_token": {"verify-token"}}.Encode()
	request := httptest.NewRequest(http.MethodGet, requestURL, nil)
	response := httptest.NewRecorder()
	server.handleWhatsAppWebhook(response, request)
	if response.Code != http.StatusOK || response.Body.String() != "challenge-123" {
		t.Fatalf("expected successful webhook challenge, got %d %q", response.Code, response.Body.String())
	}
	request = httptest.NewRequest(http.MethodGet, "/api/v1/notifications/whatsapp/webhook?hub.mode=subscribe&hub.challenge=x&hub.verify_token=wrong", nil)
	response = httptest.NewRecorder()
	server.handleWhatsAppWebhook(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected invalid token to be rejected, got %d", response.Code)
	}
}

func TestWhatsAppWebhookRejectsMissingOrWrongSignatureBeforeParsing(t *testing.T) {
	t.Setenv("WHATSAPP_APP_SECRET", "test-app-secret")
	server := &Server{}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/whatsapp/webhook", strings.NewReader(`{"object":"whatsapp_business_account","entry":[]}`))
	response := httptest.NewRecorder()
	server.handleWhatsAppWebhook(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected missing signature to be rejected, got %d", response.Code)
	}
}

func TestMetaWhatsAppProviderSendsQuickReplyTemplate(t *testing.T) {
	var received map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v26.0/phone-123/messages" {
			t.Fatalf("unexpected provider request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
			t.Fatalf("unexpected authorization header: %q", got)
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatalf("decode provider payload: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"contacts":[{"wa_id":"14155552671"}],"messages":[{"id":"wamid.test"}]}`))
	}))
	defer server.Close()

	t.Setenv("APPROVAL_SIGNING_KEY", "test-approval-signing-key")
	provider := &metaWhatsAppProvider{baseURL: server.URL, graphVersion: "v26.0", accessToken: "test-token", phoneNumberID: "phone-123", templateName: "approval_template"}
	result, err := provider.Send(context.Background(), approvalNotification{ApprovalID: uuid.NewString(), Recipient: "+14155552671", Summary: "Review draft", ReviewURL: "https://example.test/approvals/1", ExpiresAt: time.Now().Add(time.Hour), Locale: "en", IdempotencyKey: "approval:whatsapp"})
	if err != nil {
		t.Fatalf("send failed: %v", err)
	}
	if result.ProviderMessageID != "wamid.test" || result.RecipientWAID != "14155552671" {
		t.Fatalf("unexpected provider result: %+v", result)
	}
	if received["type"] != "template" {
		t.Fatalf("expected template message, got %#v", received["type"])
	}
	template, ok := received["template"].(map[string]any)
	if !ok || template["name"] != "approval_template" {
		t.Fatalf("unexpected template payload: %#v", received["template"])
	}
	components, ok := template["components"].([]any)
	if !ok || len(components) != 3 {
		t.Fatalf("expected body and two quick-reply components, got %#v", template["components"])
	}
	encoded, _ := json.Marshal(received)
	if strings.Contains(string(encoded), "test-approval-signing-key") || strings.Contains(string(encoded), "wamid.test") && strings.Contains(string(encoded), "review_token") {
		t.Fatal("provider payload must not contain signing keys or raw review tokens")
	}
}

func TestWhatsAppLinkCodeValidationAndGeneration(t *testing.T) {
	for _, value := range []string{"000000", "123456", "999999"} {
		if !validWhatsAppLinkCode(value) {
			t.Fatalf("expected valid six-digit code: %q", value)
		}
	}
	for _, value := range []string{"", "12345", "1234567", "12a456", "１２３４５６"} {
		if validWhatsAppLinkCode(value) {
			t.Fatalf("expected invalid link code: %q", value)
		}
	}
	seen := make(map[string]struct{}, 32)
	for i := 0; i < 32; i++ {
		code, digest, err := randomWhatsAppLinkCode()
		if err != nil || !validWhatsAppLinkCode(code) || len(digest) != 64 {
			t.Fatalf("unexpected generated challenge: code=%q digest=%q err=%v", code, digest, err)
		}
		if _, duplicate := seen[code]; duplicate {
			t.Logf("duplicate random code observed; statistically possible and acceptable: %q", code)
		}
		seen[code] = struct{}{}
	}
}

func TestMetaWhatsAppProviderSendsLinkCodeTemplate(t *testing.T) {
	var received map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v26.0/phone-123/messages" {
			t.Fatalf("unexpected provider request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer link-token" {
			t.Fatalf("unexpected authorization header: %q", got)
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatalf("decode provider payload: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"contacts":[{"wa_id":"14155552671"}],"messages":[{"id":"wamid.link"}]}`))
	}))
	defer server.Close()

	t.Setenv("WHATSAPP_LINK_TEMPLATE_NAME", "link_template")
	provider := &metaWhatsAppProvider{baseURL: server.URL, graphVersion: "v26.0", accessToken: "link-token", phoneNumberID: "phone-123"}
	if !provider.LinkConfigured() {
		t.Fatal("expected link provider to be configured with complete link settings")
	}
	result, err := provider.SendLinkCode(context.Background(), "+14155552671", "042381")
	if err != nil {
		t.Fatalf("link code send failed: %v", err)
	}
	if result.ProviderMessageID != "wamid.link" || result.RecipientWAID != "14155552671" {
		t.Fatalf("unexpected link provider result: %+v", result)
	}
	if received["messaging_product"] != "whatsapp" || received["to"] != "+14155552671" || received["type"] != "template" {
		t.Fatalf("unexpected link envelope: %#v", received)
	}
	template, ok := received["template"].(map[string]any)
	if !ok || template["name"] != "link_template" {
		t.Fatalf("unexpected link template: %#v", received["template"])
	}
	components, ok := template["components"].([]any)
	if !ok || len(components) != 1 {
		t.Fatalf("expected one body component, got %#v", template["components"])
	}
	body, ok := components[0].(map[string]any)
	if !ok || body["type"] != "body" {
		t.Fatalf("unexpected body component: %#v", components[0])
	}
	parameters, ok := body["parameters"].([]any)
	if !ok || len(parameters) != 1 || parameters[0].(map[string]any)["text"] != "042381" {
		t.Fatalf("expected six-digit code body parameter, got %#v", body["parameters"])
	}
}

func TestMetaWhatsAppProviderLinkCodeFailsClosed(t *testing.T) {
	t.Setenv("WHATSAPP_LINK_TEMPLATE_NAME", "")
	provider := &metaWhatsAppProvider{baseURL: "https://graph.example.test", graphVersion: "v26.0", accessToken: "token", phoneNumberID: "phone"}
	if provider.LinkConfigured() {
		t.Fatal("link provider must be disabled without the approved link template")
	}
	if _, err := provider.SendLinkCode(context.Background(), "+14155552671", "123456"); err == nil {
		t.Fatal("link send must fail closed when configuration is incomplete")
	}
}

func TestWhatsAppPhoneMaskDoesNotExposeFullNumber(t *testing.T) {
	if got := maskWhatsAppPhone("+14155552671"); got == "+14155552671" || !strings.HasSuffix(got, "2671") {
		t.Fatalf("unexpected masked phone: %q", got)
	}
}
