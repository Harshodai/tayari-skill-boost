package config

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func TestEnvSecretProvider(t *testing.T) {
	t.Setenv("TEST_KEY_EXISTS", "my-secret-val")
	provider := &EnvSecretProvider{}

	val, err := provider.GetSecret(context.Background(), "TEST_KEY_EXISTS")
	if err != nil || val != "my-secret-val" {
		t.Fatalf("expected my-secret-val, got %s, err: %v", val, err)
	}

	_, err = provider.GetSecret(context.Background(), "TEST_KEY_MISSING")
	if err == nil {
		t.Fatalf("expected error for missing key, got nil")
	}
}

type roundTripFunc func(req *http.Request) *http.Response

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

func TestVaultSecretProvider(t *testing.T) {
	mockTransport := roundTripFunc(func(req *http.Request) *http.Response {
		if req.Header.Get("X-Vault-Token") != "test-token" {
			return &http.Response{
				StatusCode: http.StatusForbidden,
				Body:       io.NopCloser(bytes.NewBufferString("forbidden")),
			}
		}
		data := map[string]interface{}{
			"data": map[string]interface{}{
				"data": map[string]interface{}{
					"JWT_SECRET": "super-secure-vault-jwt-secret-32-chars-long",
					"PORT":       "9000",
				},
			},
		}
		body, _ := json.Marshal(data)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(body)),
		}
	})

	vault := NewVaultSecretProvider("http://vault.example.com", "test-token", "secret/data/tayari")
	vault.HTTPClient = &http.Client{Transport: mockTransport}

	secret, err := vault.GetSecret(context.Background(), "JWT_SECRET")
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if secret != "super-secure-vault-jwt-secret-32-chars-long" {
		t.Fatalf("unexpected secret value: %s", secret)
	}

	// Test missing key in payload
	_, err = vault.GetSecret(context.Background(), "NON_EXISTENT")
	if err == nil {
		t.Fatalf("expected error for missing key in vault payload")
	}
}
