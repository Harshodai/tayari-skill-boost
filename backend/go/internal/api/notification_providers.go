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

type approvalNotificationProvider interface {
	Name() string
	Configured() bool
	Send(context.Context, approvalNotification) (string, error)
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

func (p *genericEmailProvider) Send(ctx context.Context, message approvalNotification) (string, error) {
	if !p.Configured() {
		return "", errors.New("approval email provider is not configured")
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
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", message.IdempotencyKey)
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("email provider returned status %d", resp.StatusCode)
	}
	var result struct {
		ID        string `json:"id"`
		MessageID string `json:"message_id"`
		RequestID string `json:"request_id"`
	}
	_ = json.Unmarshal(responseBody, &result)
	for _, value := range []string{result.ID, result.MessageID, result.RequestID} {
		if strings.TrimSpace(value) != "" {
			return value, nil
		}
	}
	return "accepted:" + message.IdempotencyKey, nil
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
	return p.baseURL != "" && p.graphVersion != "" && p.accessToken != "" && p.phoneNumberID != "" && p.templateName != ""
}

func (p *metaWhatsAppProvider) Send(ctx context.Context, message approvalNotification) (string, error) {
	if !p.Configured() {
		return "", errors.New("WhatsApp provider is not configured")
	}
	payload := map[string]any{
		"messaging_product": "whatsapp",
		"to":                message.Recipient,
		"type":              "template",
		"template": map[string]any{
			"name":     p.templateName,
			"language": map[string]string{"code": message.Locale},
			"components": []map[string]any{{
				"type": "body",
				"parameters": []map[string]string{
					{"type": "text", "text": message.Summary},
					{"type": "text", "text": message.ReviewURL},
				},
			}},
		},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	endpoint := fmt.Sprintf("%s/%s/%s/messages", p.baseURL, p.graphVersion, p.phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+p.accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", message.IdempotencyKey)
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("WhatsApp provider returned status %d", resp.StatusCode)
	}
	var result struct {
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
	}
	if json.Unmarshal(responseBody, &result) == nil && len(result.Messages) > 0 && result.Messages[0].ID != "" {
		return result.Messages[0].ID, nil
	}
	return "accepted:" + message.IdempotencyKey, nil
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
