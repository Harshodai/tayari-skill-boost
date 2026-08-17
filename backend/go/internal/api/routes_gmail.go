package api

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/models"
)

// routesGmail registers Gmail OAuth + sync routes.
// All routes degrade gracefully when GOOGLE_CLIENT_ID/SECRET are not set.
func (s *Server) routesGmail(r chi.Router) {
	// Public endpoints (Google OAuth callback and Pub/Sub push webhook)
	r.Get("/api/oauth/gmail/callback", s.handleGmailCallback)
	r.Get("/api/v1/oauth/gmail/callback", s.handleGmailCallback)
	r.Post("/api/gmail/webhook", s.handleGmailWebhook)
	r.Post("/api/v1/gmail/webhook", s.handleGmailWebhook)

	// Authenticated endpoints
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/gmail/status", s.handleGmailStatus)
		r.Get("/api/v1/gmail/status", s.handleGmailStatus)
		r.Get("/api/gmail/login", s.handleGmailLogin)
		r.Get("/api/v1/gmail/login", s.handleGmailLogin)
		r.Post("/api/gmail/sync", s.handleGmailSync)
		r.Post("/api/v1/gmail/sync", s.handleGmailSync)
		r.Post("/api/gmail/disconnect", s.handleGmailDisconnect)
		r.Post("/api/v1/gmail/disconnect", s.handleGmailDisconnect)
	})
}

// -------------------------------------------------------------------
// Gmail helpers
// -------------------------------------------------------------------

func gmailClientID() string     { return os.Getenv("GOOGLE_CLIENT_ID") }
func gmailClientSecret() string { return os.Getenv("GOOGLE_CLIENT_SECRET") }
func gmailEnabled() bool        { return gmailClientID() != "" && gmailClientSecret() != "" }

// redactEmail keeps the local part's first character and the domain, so logs
// stay correlatable without emitting the full address (PII). Inputs that do
// not look like an email — missing, multiple, or misplaced "@", an empty local
// part or domain, or any control/whitespace character — are invalid and
// collapse to "***".
func redactEmail(email string) string {
	if strings.Count(email, "@") != 1 {
		return "***"
	}
	at := strings.Index(email, "@")
	if at == 0 || at == len(email)-1 {
		return "***"
	}
	for _, r := range email {
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			return "***"
		}
	}
	return string([]rune(email)[0]) + "***@" + email[at+1:]
}

func gmailRedirectURI() string {
	if v := os.Getenv("GMAIL_REDIRECT_URI"); v != "" {
		return v
	}
	appURL := strings.TrimRight(os.Getenv("APP_URL"), "/")
	return appURL + "/api/oauth/gmail/callback"
}

func gmailFrontendURL() string {
	if v := os.Getenv("FRONTEND_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return strings.TrimRight(os.Getenv("APP_URL"), "/")
}

// -------------------------------------------------------------------
// Status
// -------------------------------------------------------------------

func (s *Server) handleGmailStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if !gmailEnabled() {
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"enabled":   false,
			"connected": false,
			"message":   "Gmail integration not configured (GOOGLE_CLIENT_ID/SECRET missing)",
		})
		return
	}
	var count int
	_ = s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM gmail_tokens WHERE user_id=$1`, user.ID).Scan(&count)
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"enabled":   true,
		"connected": count > 0,
	})
}

// -------------------------------------------------------------------
// OAuth login — redirect to Google consent
// -------------------------------------------------------------------

func (s *Server) handleGmailLogin(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if !gmailEnabled() {
		s.respondError(w, http.StatusNotImplemented,
			"Gmail integration not configured on this server")
		return
	}

	// Generate and store a CSRF state nonce
	state := uuid.New().String()
	_, err := s.DB.Conn.ExecContext(r.Context(),
		`INSERT INTO oauth_states (id, user_id, state, created_at) VALUES ($1,$2,$3,NOW())`,
		uuid.New(), user.ID, state)
	if err != nil {
		log.Printf("handleGmailLogin: failed to store state: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to initiate OAuth")
		return
	}

	// Build Google OAuth URL
	scopes := []string{
		"https://www.googleapis.com/auth/gmail.readonly",
		"openid",
		"https://www.googleapis.com/auth/userinfo.email",
	}
	params := url.Values{
		"client_id":              {gmailClientID()},
		"redirect_uri":           {gmailRedirectURI()},
		"response_type":          {"code"},
		"scope":                  {strings.Join(scopes, " ")},
		"access_type":            {"offline"},
		"prompt":                 {"consent"},
		"state":                  {state},
		"include_granted_scopes": {"true"},
	}
	authURL := "https://accounts.google.com/o/oauth2/auth?" + params.Encode()
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"auth_url": authURL})
}

// -------------------------------------------------------------------
// OAuth callback — exchange code for tokens, store them
// -------------------------------------------------------------------

func (s *Server) handleGmailCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errParam := r.URL.Query().Get("error")

	frontendURL := gmailFrontendURL()

	if errParam != "" || code == "" {
		log.Printf("handleGmailCallback: OAuth denied or code missing (error=%s)", errParam)
		http.Redirect(w, r, frontendURL+"/interview-board?gmail=denied", http.StatusFound)
		return
	}

	// Validate state nonce
	var userID uuid.UUID
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`DELETE FROM oauth_states WHERE state=$1 AND created_at > NOW()-INTERVAL '10 minutes' RETURNING user_id`,
		state).Scan(&userID)
	if err != nil {
		log.Printf("handleGmailCallback: invalid or expired state: %v", err)
		http.Redirect(w, r, frontendURL+"/interview-board?gmail=error", http.StatusFound)
		return
	}

	// Exchange code for tokens
	tokenData, err := gmailExchangeCode(r.Context(), code)
	if err != nil {
		log.Printf("handleGmailCallback: token exchange failed: %v", err)
		http.Redirect(w, r, frontendURL+"/interview-board?gmail=error", http.StatusFound)
		return
	}

	// Upsert tokens
	expiry := time.Now().Add(time.Duration(tokenData.ExpiresIn) * time.Second)
	_, err = s.DB.Conn.ExecContext(r.Context(), `
		INSERT INTO gmail_tokens (id, user_id, access_token, refresh_token, expiry, scope, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
		ON CONFLICT (user_id) DO UPDATE
		SET access_token=$3, refresh_token=CASE WHEN $4!='' THEN $4 ELSE gmail_tokens.refresh_token END,
		    expiry=$5, updated_at=NOW()`,
		uuid.New(), userID, tokenData.AccessToken, tokenData.RefreshToken, expiry, tokenData.Scope)
	if err != nil {
		log.Printf("handleGmailCallback: failed to store tokens: %v", err)
		http.Redirect(w, r, frontendURL+"/interview-board?gmail=error", http.StatusFound)
		return
	}

	// Clean up old states for this user
	_, _ = s.DB.Conn.ExecContext(r.Context(),
		`DELETE FROM oauth_states WHERE user_id=$1`, userID)

	http.Redirect(w, r, frontendURL+"/interview-board?gmail=connected", http.StatusFound)
}

// -------------------------------------------------------------------
// Sync — fetch recent Gmail messages and parse into Kanban
// -------------------------------------------------------------------

func (s *Server) handleGmailSync(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if !gmailEnabled() {
		s.respondError(w, http.StatusServiceUnavailable, "Gmail integration not configured")
		return
	}

	// Load user's token
	var accessToken, refreshToken string
	var expiry time.Time
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT access_token, refresh_token, expiry FROM gmail_tokens WHERE user_id=$1`,
		user.ID).Scan(&accessToken, &refreshToken, &expiry)
	if err != nil {
		s.respondError(w, http.StatusPreconditionFailed, "Gmail not connected. Use /api/gmail/login first.")
		return
	}

	// Refresh token if expired
	if time.Now().After(expiry.Add(-5 * time.Minute)) {
		newToken, err := gmailRefreshToken(r.Context(), refreshToken)
		if err != nil {
			log.Printf("handleGmailSync: token refresh failed: %v", err)
			s.respondError(w, http.StatusUnauthorized, "Gmail token expired. Please reconnect.")
			return
		}
		accessToken = newToken.AccessToken
		newExpiry := time.Now().Add(time.Duration(newToken.ExpiresIn) * time.Second)
		_, _ = s.DB.Conn.ExecContext(r.Context(),
			`UPDATE gmail_tokens SET access_token=$1, expiry=$2, updated_at=NOW() WHERE user_id=$3`,
			accessToken, newExpiry, user.ID)
	}

	// Fetch recent messages from Gmail
	messages, err := gmailFetchMessages(r.Context(), accessToken, 20)
	if err != nil {
		log.Printf("handleGmailSync: Gmail API call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch Gmail messages")
		return
	}

	parsed := 0
	skipped := 0
	for _, msg := range messages {
		body := fmt.Sprintf("Subject: %s\nFrom: %s\n\n%s",
			msg.Subject, msg.From, msg.Body)

		// Call Python AI to parse
		aiResult, err := s.AI.PostJSON("/api/v1/gmail/parse-email", map[string]interface{}{
			"email_text":   body,
			"subject":      msg.Subject,
			"from_address": msg.From,
		})
		if err != nil {
			skipped++
			continue
		}
		isJobRelated, _ := aiResult["is_job_related"].(bool)
		if !isJobRelated {
			skipped++
			continue
		}

		company, _ := aiResult["company"].(string)
		title, _ := aiResult["title"].(string)
		stage, _ := aiResult["stage"].(string)
		if stage == "" {
			stage = "applied"
		}
		// Upsert application (dedupe by company+title)
		_, _ = s.DB.Conn.ExecContext(r.Context(), `
			INSERT INTO applications
			  (application_id, user_id, title, company, stage, status, notes, job, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$5,$6,'{}',NOW(),NOW())
			ON CONFLICT DO NOTHING`,
			uuid.New(), user.ID, title, company, stage,
			fmt.Sprintf("Imported from Gmail: %s", msg.Subject))
		parsed++
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"parsed":  parsed,
		"skipped": skipped,
		"total":   len(messages),
	})
}

// -------------------------------------------------------------------
// Disconnect
// -------------------------------------------------------------------

func (s *Server) handleGmailDisconnect(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	_, _ = s.DB.Conn.ExecContext(r.Context(),
		`DELETE FROM gmail_tokens WHERE user_id=$1`, user.ID)
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// -------------------------------------------------------------------
// Webhook — Google Cloud Pub/Sub Push Notification Listener
// -------------------------------------------------------------------

type pubSubNotification struct {
	Message struct {
		Data        string `json:"data"`
		MessageID   string `json:"messageId"`
		PublishTime string `json:"publishTime"`
	} `json:"message"`
	Subscription string `json:"subscription"`
}

type pubSubGmailData struct {
	EmailAddress string `json:"emailAddress"`
	HistoryID    uint64 `json:"historyId"`
}

// verifyPubSubPush authenticates a Google Pub/Sub push delivery before any
// user inbox is touched. Google can be configured to attach either a shared
// verification token (?token=...) or a signed OIDC bearer token; we accept a
// constant-time match against GMAIL_PUBSUB_VERIFICATION_TOKEN (falling back to
// AI_INTERNAL_TOKEN for internal replays) presented in either place. The check
// fails closed: with no secret configured the webhook is disabled entirely, so
// an anonymous caller can never trigger a sync.
func (s *Server) verifyPubSubPush(r *http.Request) bool {
	expected := os.Getenv("GMAIL_PUBSUB_VERIFICATION_TOKEN")
	if expected == "" {
		expected = os.Getenv("AI_INTERNAL_TOKEN")
	}
	if expected == "" {
		return false
	}
	candidates := []string{
		r.URL.Query().Get("token"),
		r.Header.Get("X-Internal-Token"),
	}
	if authz := r.Header.Get("Authorization"); strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		candidates = append(candidates, strings.TrimSpace(authz[7:]))
	}
	for _, c := range candidates {
		if c != "" && subtle.ConstantTimeCompare([]byte(c), []byte(expected)) == 1 {
			return true
		}
	}
	return false
}

func (s *Server) handleGmailWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !s.verifyPubSubPush(r) {
		log.Printf("[GmailWebhook] Rejected unverified push delivery")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil || len(body) == 0 {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var notif pubSubNotification
	if err := json.Unmarshal(body, &notif); err != nil {
		s.respondJSON(w, http.StatusOK, map[string]interface{}{"status": "ignored", "reason": "invalid json"})
		return
	}

	if notif.Message.Data == "" {
		s.respondJSON(w, http.StatusOK, map[string]interface{}{"status": "ok", "reason": "empty message data"})
		return
	}

	dataBytes, err := base64.StdEncoding.DecodeString(notif.Message.Data)
	if err != nil {
		s.respondJSON(w, http.StatusOK, map[string]interface{}{"status": "ok", "reason": "base64 decode error"})
		return
	}

	var gmailData pubSubGmailData
	_ = json.Unmarshal(dataBytes, &gmailData)

	log.Printf("[GmailWebhook] Received notification for %s (HistoryId: %d)", redactEmail(gmailData.EmailAddress), gmailData.HistoryID)

	go func(email string) {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		if s.DB == nil || s.DB.Conn == nil {
			return
		}

		var userID uuid.UUID
		var accessToken, refreshToken string
		var expiry time.Time

		// Q7: when the Pub/Sub message carries no notified address we must NOT
		// fall back to "most recently updated token across all users" — that
		// routes one user's inbox change into another user's sync pipeline
		// (cross-tenant mis-attribution). Refuse to guess; log and return so
		// the next webhook with a real email lands in the right account.
		var err error
		if email == "" {
			log.Printf("[GmailWebhook] No notified address in message — refusing to attribute to a tenant")
			return
		}
		err = s.DB.Conn.QueryRowContext(ctx,
			`SELECT user_id, access_token, refresh_token, expiry FROM gmail_tokens WHERE user_id IN (SELECT id FROM users WHERE email=$1)`,
			email).Scan(&userID, &accessToken, &refreshToken, &expiry)

		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				log.Printf("[GmailWebhook] No matching token/account for email %s", redactEmail(email))
			} else {
				log.Printf("[GmailWebhook] Token lookup failed for email %s: %v", redactEmail(email), err)
			}
			return
		}

		if time.Now().After(expiry.Add(-5 * time.Minute)) {
			newToken, err := gmailRefreshToken(ctx, refreshToken)
			if err == nil && newToken.AccessToken != "" {
				accessToken = newToken.AccessToken
				newExpiry := time.Now().Add(time.Duration(newToken.ExpiresIn) * time.Second)
				_, _ = s.DB.Conn.ExecContext(ctx,
					`UPDATE gmail_tokens SET access_token=$1, expiry=$2, updated_at=NOW() WHERE user_id=$3`,
					accessToken, newExpiry, userID)
			}
		}

		messages, err := gmailFetchMessages(ctx, accessToken, 10)
		if err != nil {
			log.Printf("[GmailWebhook] Failed fetching messages: %v", err)
			return
		}

		for _, msg := range messages {
			bodyText := fmt.Sprintf("Subject: %s\nFrom: %s\n\n%s", msg.Subject, msg.From, msg.Body)
			aiResult, err := s.AI.PostJSON("/api/v1/gmail/parse-email", map[string]interface{}{
				"email_text":   bodyText,
				"subject":      msg.Subject,
				"from_address": msg.From,
			})
			if err != nil {
				continue
			}

			isJobRelated, _ := aiResult["is_job_related"].(bool)
			if !isJobRelated {
				continue
			}

			company, _ := aiResult["company"].(string)
			title, _ := aiResult["title"].(string)
			stage, _ := aiResult["stage"].(string)
			if stage == "" {
				stage = "applied"
			}

			_, _ = s.DB.Conn.ExecContext(ctx, `
				INSERT INTO applications
				  (application_id, user_id, title, company, stage, status, notes, job, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$5,$6,'{}',NOW(),NOW())
				ON CONFLICT DO NOTHING`,
				uuid.New(), userID, title, company, stage,
				fmt.Sprintf("Imported via Gmail Webhook: %s", msg.Subject))
		}
	}(gmailData.EmailAddress)

	s.respondJSON(w, http.StatusOK, map[string]interface{}{"status": "processing"})
}

// -------------------------------------------------------------------
// Gmail API helpers
// -------------------------------------------------------------------

type gmailTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
}

type gmailMessage struct {
	ID      string
	Subject string
	From    string
	Body    string
}

func gmailExchangeCode(ctx context.Context, code string) (*gmailTokenResponse, error) {
	params := url.Values{
		"code":          {code},
		"client_id":     {gmailClientID()},
		"client_secret": {gmailClientSecret()},
		"redirect_uri":  {gmailRedirectURI()},
		"grant_type":    {"authorization_code"},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://oauth2.googleapis.com/token", strings.NewReader(params.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token exchange HTTP: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange status %d: %s", resp.StatusCode, body)
	}
	var tok gmailTokenResponse
	if err := json.Unmarshal(body, &tok); err != nil {
		return nil, fmt.Errorf("token decode: %w", err)
	}
	return &tok, nil
}

func gmailRefreshToken(ctx context.Context, refreshToken string) (*gmailTokenResponse, error) {
	params := url.Values{
		"refresh_token": {refreshToken},
		"client_id":     {gmailClientID()},
		"client_secret": {gmailClientSecret()},
		"grant_type":    {"refresh_token"},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://oauth2.googleapis.com/token", strings.NewReader(params.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var tok gmailTokenResponse
	_ = json.Unmarshal(body, &tok)
	return &tok, nil
}

func gmailFetchMessages(ctx context.Context, accessToken string, maxResults int) ([]gmailMessage, error) {
	// Step 1: list recent message IDs
	listURL := fmt.Sprintf(
		"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=%d&q=subject:(offer OR interview OR application OR applied OR reject)",
		maxResults)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, listURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gmail list: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gmail list status %d: %s", resp.StatusCode, body)
	}

	var listResp struct {
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(body, &listResp); err != nil {
		return nil, fmt.Errorf("gmail list decode: %w", err)
	}

	// Step 2: fetch each message (only subject + snippet)
	var msgs []gmailMessage
	for _, m := range listResp.Messages {
		detail, err := gmailGetMessage(ctx, accessToken, m.ID)
		if err != nil {
			log.Printf("gmailFetchMessages: failed to get message %s: %v", m.ID, err)
			continue
		}
		msgs = append(msgs, *detail)
	}
	return msgs, nil
}

func gmailGetMessage(ctx context.Context, accessToken, id string) (*gmailMessage, error) {
	msgURL := fmt.Sprintf(
		"https://gmail.googleapis.com/gmail/v1/users/me/messages/%s?format=metadata&metadataHeaders=Subject&metadataHeaders=From",
		id)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, msgURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var raw struct {
		Snippet string `json:"snippet"`
		Payload struct {
			Headers []struct {
				Name  string `json:"name"`
				Value string `json:"value"`
			} `json:"headers"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	msg := gmailMessage{ID: id, Body: raw.Snippet}
	for _, h := range raw.Payload.Headers {
		switch h.Name {
		case "Subject":
			msg.Subject = h.Value
		case "From":
			msg.From = h.Value
		}
	}
	return &msg, nil
}

// Unused import guard
var _ = chi.URLParam
