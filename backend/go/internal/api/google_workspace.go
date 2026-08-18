package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"

	"github.com/google/uuid"
)

const (
	googleCalendarScope = "https://www.googleapis.com/auth/calendar.events.readonly"
	googleDriveScope    = "https://www.googleapis.com/auth/drive.metadata.readonly"
	googleOpenIDScope   = "openid"
	googleEmailScope    = "https://www.googleapis.com/auth/userinfo.email"
)

type googleWorkspaceTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
}

func googleWorkspaceEnabled() bool {
	return strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")) != "" && strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")) != ""
}

func googleWorkspaceClientID() string { return strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")) }
func googleWorkspaceClientSecret() string {
	return strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET"))
}

func googleWorkspaceFrontendURL() string {
	if value := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/"); value != "" {
		return value
	}
	return strings.TrimRight(strings.TrimSpace(os.Getenv("APP_URL")), "/")
}

func googleWorkspaceRedirectURI(provider string) string {
	envKey := "GOOGLE_" + strings.ToUpper(provider) + "_REDIRECT_URI"
	if value := strings.TrimSpace(os.Getenv(envKey)); value != "" {
		return value
	}
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("APP_URL")), "/")
	return fmt.Sprintf("%s/api/oauth/google/%s/callback", base, provider)
}

// verifiedWorkspaceTenant returns the active tenant only when the auth context
// and authenticated user agree. In development, a nil tenant is allowed for
// local single-tenant installs. Staging/production fail closed without one.
func verifiedWorkspaceTenant(r *http.Request, user *models.User) (uuid.UUID, bool) {
	if user == nil {
		return uuid.Nil, false
	}
	authorization, ok := auth.AuthorizationContextFromContext(r.Context())
	if !ok || authorization.Subject != user.ID {
		return uuid.Nil, false
	}
	if tenant, ok := r.Context().Value(contextKeyTenant).(*models.Tenant); ok && tenant != nil {
		if authorization.TenantID != uuid.Nil && authorization.TenantID != tenant.ID {
			return uuid.Nil, false
		}
		return tenant.ID, true
	}
	environment := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if environment == "production" || environment == "prod" || environment == "staging" {
		return uuid.Nil, false
	}
	return uuid.Nil, true
}

func googleWorkspaceOAuthURL(provider string, state string, scope string) string {
	params := url.Values{
		"client_id":              {googleWorkspaceClientID()},
		"redirect_uri":           {googleWorkspaceRedirectURI(provider)},
		"response_type":          {"code"},
		"scope":                  {strings.Join([]string{scope, googleOpenIDScope, googleEmailScope}, " ")},
		"access_type":            {"offline"},
		"prompt":                 {"consent"},
		"state":                  {state},
		"include_granted_scopes": {"true"},
	}
	return "https://accounts.google.com/o/oauth2/auth?" + params.Encode()
}

func googleWorkspaceExchangeCode(ctx context.Context, provider string, code string) (*googleWorkspaceTokenResponse, error) {
	params := url.Values{
		"code":          {code},
		"client_id":     {googleWorkspaceClientID()},
		"client_secret": {googleWorkspaceClientSecret()},
		"redirect_uri":  {googleWorkspaceRedirectURI(provider)},
		"grant_type":    {"authorization_code"},
	}
	return googleWorkspaceTokenRequest(ctx, params)
}

func googleWorkspaceRefreshToken(ctx context.Context, refreshToken string) (*googleWorkspaceTokenResponse, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return nil, fmt.Errorf("missing Google refresh token")
	}
	params := url.Values{
		"refresh_token": {refreshToken},
		"client_id":     {googleWorkspaceClientID()},
		"client_secret": {googleWorkspaceClientSecret()},
		"grant_type":    {"refresh_token"},
	}
	return googleWorkspaceTokenRequest(ctx, params)
}

func googleWorkspaceTokenRequest(ctx context.Context, params url.Values) (*googleWorkspaceTokenResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token exchange HTTP: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var token googleWorkspaceTokenResponse
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("token decode: %w", err)
	}
	if token.AccessToken == "" {
		return nil, fmt.Errorf("Google token response omitted access_token")
	}
	return &token, nil
}

func googleWorkspaceExpiry(expiresIn int) time.Time {
	if expiresIn <= 0 {
		return time.Now().Add(45 * time.Minute)
	}
	return time.Now().Add(time.Duration(expiresIn) * time.Second)
}

func googleWorkspaceAuthRequest(ctx context.Context, method string, endpoint string, accessToken string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	return http.DefaultClient.Do(req)
}

func googleWorkspaceStatusResponse(enabled, connected bool, capability string, message string) map[string]interface{} {
	response := map[string]interface{}{
		"enabled":    enabled,
		"connected":  connected,
		"capability": capability,
		"read_only":  true,
	}
	if message != "" {
		response["message"] = message
	}
	return response
}
