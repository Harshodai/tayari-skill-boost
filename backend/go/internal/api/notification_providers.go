package api

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type approvalNotification struct {
	ApprovalID     string
	Recipient      string
	Summary        string
	ReviewURL      string
	ExpiresAt      time.Time
	Locale         string
	IdempotencyKey string
}

type notificationSendResult struct {
	ProviderMessageID string
	RecipientWAID     string
}

type approvalNotificationProvider interface {
	Name() string
	Configured() bool
	Send(context.Context, approvalNotification) (notificationSendResult, error)
}

type genericEmailProvider struct {
	endpoint string
	apiKey   string
	from     string
}

func newGenericEmailProvider() *genericEmailProvider {
	return &genericEmailProvider{
		endpoint: strings.TrimSpace(os.Getenv("APPROVAL_EMAIL_ENDPOINT")),
		apiKey:   strings.TrimSpace(os.Getenv("APPROVAL_EMAIL_API_KEY")),
		from:     strings.TrimSpace(os.Getenv("APPROVAL_EMAIL_FROM")),
	}
}

func (p *genericEmailProvider) Name() string { return "transactional_email" }
func (p *genericEmailProvider) Configured() bool {
	return p.endpoint != "" && p.apiKey != "" && p.from != ""
}

func (p *genericEmailProvider) Send(ctx context.Context, message approvalNotification) (notificationSendResult, error) {
	if !p.Configured() {
		return notificationSendResult{}, errors.New("approval email provider is not configured")
	}
	body := map[string]any{
		"from":            p.from,
		"to":              message.Recipient,
		"subject":         "JobTayari approval required",
		"text":            fmt.Sprintf("JobTayari needs your approval: %s. Review: %s. Expires: %s", message.Summary, message.ReviewURL, message.ExpiresAt.UTC().Format(time.RFC3339)),
		"approval_id":     message.ApprovalID,
		"idempotency_key": message.IdempotencyKey,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return notificationSendResult{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(payload))
	if err != nil {
		return notificationSendResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", message.IdempotencyKey)
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return notificationSendResult{}, err
	}
	defer resp.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return notificationSendResult{}, fmt.Errorf("email provider returned status %d", resp.StatusCode)
	}
	var result struct {
		ID        string `json:"id"`
		MessageID string `json:"message_id"`
		RequestID string `json:"request_id"`
	}
	_ = json.Unmarshal(responseBody, &result)
	for _, value := range []string{result.ID, result.MessageID, result.RequestID} {
		if strings.TrimSpace(value) != "" {
			return notificationSendResult{ProviderMessageID: value}, nil
		}
	}
	return notificationSendResult{ProviderMessageID: "accepted:" + message.IdempotencyKey}, nil
}

type metaWhatsAppProvider struct {
	baseURL       string
	graphVersion  string
	accessToken   string
	phoneNumberID string
	templateName  string
}

func newMetaWhatsAppProvider() *metaWhatsAppProvider {
	return &metaWhatsAppProvider{
		baseURL:       strings.TrimRight(strings.TrimSpace(os.Getenv("WHATSAPP_GRAPH_API_BASE_URL")), "/"),
		graphVersion:  strings.Trim(strings.TrimSpace(os.Getenv("WHATSAPP_GRAPH_API_VERSION")), "/"),
		accessToken:   strings.TrimSpace(os.Getenv("WHATSAPP_ACCESS_TOKEN")),
		phoneNumberID: strings.TrimSpace(os.Getenv("WHATSAPP_PHONE_NUMBER_ID")),
		templateName:  strings.TrimSpace(os.Getenv("WHATSAPP_APPROVAL_TEMPLATE_NAME")),
	}
}

func (p *metaWhatsAppProvider) Name() string { return "meta_whatsapp" }
func (p *metaWhatsAppProvider) Configured() bool {
	return p.baseURL != "" && p.graphVersion != "" && p.accessToken != "" && p.phoneNumberID != "" && p.templateName != "" && approvalSigningKey() != ""
}

func (p *metaWhatsAppProvider) LinkConfigured() bool {
	return p.baseURL != "" && p.graphVersion != "" && p.accessToken != "" && p.phoneNumberID != "" && strings.TrimSpace(os.Getenv("WHATSAPP_LINK_TEMPLATE_NAME")) != ""
}

func (p *metaWhatsAppProvider) SendLinkCode(ctx context.Context, recipient, code string) (notificationSendResult, error) {
	if !p.LinkConfigured() || !validWhatsAppPhoneE164(recipient) || !validWhatsAppLinkCode(code) {
		return notificationSendResult{}, errors.New("WhatsApp linking provider is not configured")
	}
	payload := map[string]any{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "template",
		"template": map[string]any{
			"name":     strings.TrimSpace(os.Getenv("WHATSAPP_LINK_TEMPLATE_NAME")),
			"language": map[string]string{"code": "en"},
			"components": []map[string]any{{
				"type":       "body",
				"parameters": []map[string]string{{"type": "text", "text": code}},
			}},
		},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return notificationSendResult{}, err
	}
	endpoint := fmt.Sprintf("%s/%s/%s/messages", p.baseURL, p.graphVersion, p.phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return notificationSendResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.accessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return notificationSendResult{}, err
	}
	defer resp.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return notificationSendResult{}, fmt.Errorf("WhatsApp link provider returned status %d", resp.StatusCode)
	}
	var result struct {
		Contacts []struct {
			WAID string `json:"wa_id"`
		} `json:"contacts"`
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
	}
	if json.Unmarshal(responseBody, &result) != nil || len(result.Messages) == 0 || strings.TrimSpace(result.Messages[0].ID) == "" {
		return notificationSendResult{}, errors.New("WhatsApp link provider returned no message id")
	}
	sendResult := notificationSendResult{ProviderMessageID: result.Messages[0].ID}
	if len(result.Contacts) > 0 {
		sendResult.RecipientWAID = strings.TrimSpace(result.Contacts[0].WAID)
	}
	return sendResult, nil
}

func (p *metaWhatsAppProvider) Send(ctx context.Context, message approvalNotification) (notificationSendResult, error) {
	if !p.Configured() {
		return notificationSendResult{}, errors.New("WhatsApp provider is not configured")
	}
	payload := map[string]any{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                message.Recipient,
		"type":              "template",
		"template": map[string]any{
			"name":     p.templateName,
			"language": map[string]string{"code": message.Locale},
			"components": []map[string]any{
				{
					"type": "body",
					"parameters": []map[string]string{
						{"type": "text", "text": message.Summary},
						{"type": "text", "text": message.ReviewURL},
					},
				},
				{
					"type":     "button",
					"sub_type": "quick_reply",
					"index":    "0",
					"parameters": []map[string]string{{
						"type":    "payload",
						"payload": whatsappApprovalButtonPayload(message.ApprovalID, "approve"),
					}},
				},
				{
					"type":     "button",
					"sub_type": "quick_reply",
					"index":    "1",
					"parameters": []map[string]string{{
						"type":    "payload",
						"payload": whatsappApprovalButtonPayload(message.ApprovalID, "deny"),
					}},
				},
			},
		},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return notificationSendResult{}, err
	}
	endpoint := fmt.Sprintf("%s/%s/%s/messages", p.baseURL, p.graphVersion, p.phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return notificationSendResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", message.IdempotencyKey)
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return notificationSendResult{}, err
	}
	defer resp.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return notificationSendResult{}, fmt.Errorf("WhatsApp provider returned status %d", resp.StatusCode)
	}
	var result struct {
		Contacts []struct {
			WAID string `json:"wa_id"`
		} `json:"contacts"`
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
	}
	if json.Unmarshal(responseBody, &result) == nil && len(result.Messages) > 0 && result.Messages[0].ID != "" {
		sendResult := notificationSendResult{ProviderMessageID: result.Messages[0].ID}
		if len(result.Contacts) > 0 {
			sendResult.RecipientWAID = strings.TrimSpace(result.Contacts[0].WAID)
		}
		return sendResult, nil
	}
	return notificationSendResult{ProviderMessageID: "accepted:" + message.IdempotencyKey}, nil
}

func webhookHMACValid(secret string, body []byte, signature string) bool {
	secret = strings.TrimSpace(secret)
	if secret == "" || signature == "" {
		return false
	}
	provided := strings.TrimSpace(strings.TrimPrefix(signature, "sha256="))
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(strings.ToLower(provided)), []byte(expected))
}
