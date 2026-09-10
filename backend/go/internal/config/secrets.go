package config

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// SecretProvider abstracts secrets fetching from external vaults (AWS Secrets Manager, HashiCorp Vault)
// with seamless fallback to environment variables.
type SecretProvider interface {
	GetSecret(ctx context.Context, key string) (string, error)
}

// EnvSecretProvider retrieves secrets from process environment variables.
type EnvSecretProvider struct{}

func (e *EnvSecretProvider) GetSecret(ctx context.Context, key string) (string, error) {
	if val, exists := os.LookupEnv(key); exists && strings.TrimSpace(val) != "" {
		return val, nil
	}
	return "", fmt.Errorf("secret %q not found in environment", key)
}

// VaultSecretProvider queries HashiCorp Vault's KV v2 API.
type VaultSecretProvider struct {
	Addr       string
	Token      string
	Path       string
	HTTPClient *http.Client
	cache      map[string]string
	mu         sync.RWMutex
	lastFetch  time.Time
	cacheTTL   time.Duration
}

// NewVaultSecretProvider constructs a Vault provider from environment variables.
func NewVaultSecretProvider(addr, token, path string) *VaultSecretProvider {
	return &VaultSecretProvider{
		Addr:       strings.TrimRight(addr, "/"),
		Token:      token,
		Path:       strings.Trim(path, "/"),
		HTTPClient: &http.Client{Timeout: 5 * time.Second},
		cache:      make(map[string]string),
		cacheTTL:   5 * time.Minute,
	}
}

func (v *VaultSecretProvider) GetSecret(ctx context.Context, key string) (string, error) {
	v.mu.RLock()
	if time.Since(v.lastFetch) < v.cacheTTL {
		if val, ok := v.cache[key]; ok {
			v.mu.RUnlock()
			return val, nil
		}
	}
	v.mu.RUnlock()

	// Fetch from Vault KV v2: /v1/{path}
	reqURL := fmt.Sprintf("%s/v1/%s", v.Addr, v.Path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Vault-Token", v.Token)

	resp, err := v.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("vault request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("vault returned status %d: %s", resp.StatusCode, string(body))
	}

	var vaultResp struct {
		Data struct {
			Data map[string]interface{} `json:"data"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&vaultResp); err != nil {
		return "", fmt.Errorf("failed to decode vault response: %w", err)
	}

	v.mu.Lock()
	defer v.mu.Unlock()
	v.cache = make(map[string]string)
	for k, val := range vaultResp.Data.Data {
		v.cache[k] = fmt.Sprintf("%v", val)
	}
	v.lastFetch = time.Now()

	if val, ok := v.cache[key]; ok {
		return val, nil
	}
	return "", fmt.Errorf("secret %q not found in vault payload", key)
}

var (
	activeProvider SecretProvider
	providerOnce   sync.Once
)

// GetActiveSecretProvider initializes and returns the configured SecretProvider.
// If VAULT_ADDR and VAULT_TOKEN are set, VaultSecretProvider is used.
// Otherwise, EnvSecretProvider is used as the default.
func GetActiveSecretProvider() SecretProvider {
	providerOnce.Do(func() {
		vaultAddr := os.Getenv("VAULT_ADDR")
		vaultToken := os.Getenv("VAULT_TOKEN")
		vaultPath := os.Getenv("VAULT_SECRET_PATH")
		if vaultPath == "" {
			vaultPath = "secret/data/tayari"
		}

		if vaultAddr != "" && vaultToken != "" {
			slog.Info("Secrets provider: HashiCorp Vault initialized", "addr", vaultAddr, "path", vaultPath)
			activeProvider = NewVaultSecretProvider(vaultAddr, vaultToken, vaultPath)
		} else {
			activeProvider = &EnvSecretProvider{}
		}
	})
	return activeProvider
}

// FetchSecret retrieves a secret by key using the active provider, falling back to os.Getenv or the fallback value.
func FetchSecret(ctx context.Context, key, fallback string) string {
	provider := GetActiveSecretProvider()
	val, err := provider.GetSecret(ctx, key)
	if err == nil && val != "" {
		return val
	}
	if envVal, exists := os.LookupEnv(key); exists && envVal != "" {
		return envVal
	}
	return fallback
}
