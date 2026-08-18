package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"tayari-backend/internal/capabilities"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const googleCalendarCapability = capabilities.Name("workspace.google.calendar")

func (s *Server) routesGoogleCalendar(r chi.Router) {
	r.Get("/api/oauth/google/calendar/callback", s.handleGoogleCalendarCallback)
	r.Get("/api/v1/oauth/google/calendar/callback", s.handleGoogleCalendarCallback)

	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/google/calendar/status", s.handleGoogleCalendarStatus)
		r.Get("/api/v1/google/calendar/status", s.handleGoogleCalendarStatus)
		r.Get("/api/google/calendar/login", s.handleGoogleCalendarLogin)
		r.Get("/api/v1/google/calendar/login", s.handleGoogleCalendarLogin)
		r.Post("/api/google/calendar/sync", s.handleGoogleCalendarSync)
		r.Post("/api/v1/google/calendar/sync", s.handleGoogleCalendarSync)
		r.Post("/api/google/calendar/disconnect", s.handleGoogleCalendarDisconnect)
		r.Post("/api/v1/google/calendar/disconnect", s.handleGoogleCalendarDisconnect)
	})
}

func calendarUser(r *http.Request) (*models.User, uuid.UUID, bool) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		return nil, uuid.Nil, false
	}
	tenantID, ok := verifiedWorkspaceTenant(r, user)
	return user, tenantID, ok
}

func (s *Server) handleGoogleCalendarStatus(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := calendarUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !googleWorkspaceEnabled() {
		s.respondJSON(w, http.StatusOK, googleWorkspaceStatusResponse(false, false, string(googleCalendarCapability), "Google Workspace is not configured on this server."))
		return
	}
	var count int
	err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM google_calendar_tokens WHERE user_id=$1 AND tenant_id=$2`, user.ID, tenantID).Scan(&count)
	if err != nil {
		log.Printf("handleGoogleCalendarStatus: token lookup failed: %v", err)
		s.respondError(w, http.StatusServiceUnavailable, "Calendar connection status is unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, googleWorkspaceStatusResponse(true, count > 0, string(googleCalendarCapability), ""))
}

func (s *Server) handleGoogleCalendarLogin(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := calendarUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.requireCapability(w, googleCalendarCapability) {
		return
	}
	if !googleWorkspaceEnabled() {
		s.respondError(w, http.StatusNotImplemented, "Google Workspace is not configured on this server")
		return
	}
	state := "google-calendar:" + uuid.NewString()
	if _, err := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO oauth_states (id, user_id, tenant_id, provider, state, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`, uuid.New(), user.ID, tenantID, "google_calendar", state); err != nil {
		log.Printf("handleGoogleCalendarLogin: failed to store OAuth state: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to initiate Calendar OAuth")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"auth_url":  googleWorkspaceOAuthURL("calendar", state, googleCalendarScope),
		"scope":     googleCalendarScope,
		"read_only": true,
	})
}

func (s *Server) handleGoogleCalendarCallback(w http.ResponseWriter, r *http.Request) {
	frontendURL := googleWorkspaceFrontendURL()
	redirect := func(status string) {
		http.Redirect(w, r, frontendURL+"/settings?google_calendar="+url.QueryEscape(status), http.StatusFound)
	}
	if r.URL.Query().Get("error") != "" || r.URL.Query().Get("code") == "" {
		redirect("denied")
		return
	}
	var userID, tenantID uuid.UUID
	var provider string
	err := s.DB.Conn.QueryRowContext(r.Context(), `DELETE FROM oauth_states WHERE state=$1 AND provider=$2 AND created_at > NOW()-INTERVAL '10 minutes' RETURNING user_id, tenant_id, provider`, r.URL.Query().Get("state"), "google_calendar").Scan(&userID, &tenantID, &provider)
	if err != nil || provider != "google_calendar" || userID == uuid.Nil || tenantID == uuid.Nil {
		log.Printf("handleGoogleCalendarCallback: invalid or expired state: %v", err)
		redirect("error")
		return
	}
	token, err := googleWorkspaceExchangeCode(r.Context(), "calendar", r.URL.Query().Get("code"))
	if err != nil {
		log.Printf("handleGoogleCalendarCallback: token exchange failed: %v", err)
		redirect("error")
		return
	}
	_, err = s.DB.Conn.ExecContext(r.Context(), `INSERT INTO google_calendar_tokens (id, user_id, tenant_id, access_token, refresh_token, expiry, scope, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) ON CONFLICT (user_id, tenant_id) DO UPDATE SET access_token=$4, refresh_token=CASE WHEN $5!='' THEN $5 ELSE google_calendar_tokens.refresh_token END, expiry=$6, scope=$7, updated_at=NOW()`, uuid.New(), userID, tenantID, token.AccessToken, token.RefreshToken, googleWorkspaceExpiry(token.ExpiresIn), token.Scope)
	if err != nil {
		log.Printf("handleGoogleCalendarCallback: token persistence failed: %v", err)
		redirect("error")
		return
	}
	redirect("connected")
}

func (s *Server) handleGoogleCalendarSync(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := calendarUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.requireCapability(w, googleCalendarCapability) {
		return
	}
	if !googleWorkspaceEnabled() {
		s.respondError(w, http.StatusServiceUnavailable, "Google Calendar is not configured")
		return
	}
	var accessToken, refreshToken string
	var expiry time.Time
	err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT access_token, refresh_token, expiry FROM google_calendar_tokens WHERE user_id=$1 AND tenant_id=$2`, user.ID, tenantID).Scan(&accessToken, &refreshToken, &expiry)
	if err != nil {
		s.respondError(w, http.StatusPreconditionFailed, "Google Calendar is not connected. Use Calendar login first.")
		return
	}
	if time.Now().After(expiry.Add(-5 * time.Minute)) {
		refreshed, refreshErr := googleWorkspaceRefreshToken(r.Context(), refreshToken)
		if refreshErr != nil {
			s.respondError(w, http.StatusUnauthorized, "Google Calendar token expired. Please reconnect.")
			return
		}
		accessToken = refreshed.AccessToken
		_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE google_calendar_tokens SET access_token=$1, expiry=$2, updated_at=NOW() WHERE user_id=$3 AND tenant_id=$4`, accessToken, googleWorkspaceExpiry(refreshed.ExpiresIn), user.ID, tenantID)
	}
	events, err := googleCalendarFetchUpcoming(r.Context(), accessToken)
	if err != nil {
		log.Printf("handleGoogleCalendarSync: Calendar API call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch Google Calendar events")
		return
	}
	// First release is read-only: persist only a tenant-bound, provenance-linked
	// event snapshot. No external Calendar event is created or edited, and no
	// application record is fabricated from an unreviewed event.
	imported := 0
	for _, event := range events {
		if event.ID == "" {
			continue
		}
		_, writeErr := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO google_calendar_events (id, user_id, tenant_id, provider_event_id, calendar_id, summary, description, start_time, html_link, provenance, created_at, updated_at) VALUES ($1,$2,$3,$4,'primary',$5,$6,$7,$8,'google_calendar_readonly',NOW(),NOW()) ON CONFLICT (user_id, tenant_id, provider_event_id) DO UPDATE SET summary=$5, description=$6, start_time=$7, html_link=$8, updated_at=NOW()`, uuid.New(), user.ID, tenantID, event.ID, event.Summary, event.Description, parseGoogleCalendarTime(event.Start), event.HTMLLink)
		if writeErr == nil {
			imported++
		}
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "read_only": true, "total": len(events), "imported": imported, "provenance": "google_calendar_readonly"})
}

type googleCalendarEvent struct {
	ID          string `json:"id"`
	Summary     string `json:"summary"`
	Description string `json:"description"`
	Start       string `json:"start"`
	HTMLLink    string `json:"htmlLink"`
}

func googleCalendarFetchUpcoming(ctx context.Context, accessToken string) ([]googleCalendarEvent, error) {
	params := url.Values{
		"singleEvents": {"true"},
		"orderBy":      {"startTime"},
		"maxResults":   {"50"},
		"timeMin":      {time.Now().UTC().Format(time.RFC3339)},
	}
	resp, err := googleWorkspaceAuthRequest(ctx, http.MethodGet, "https://www.googleapis.com/calendar/v3/calendars/primary/events?"+params.Encode(), accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("calendar events status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload struct {
		Items []googleCalendarEvent `json:"items"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return payload.Items, nil
}

func parseGoogleCalendarTime(value string) *time.Time {
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return &parsed
		}
	}
	return nil
}

func calendarEventLabels(event googleCalendarEvent) (string, string) {
	text := strings.TrimSpace(event.Summary)
	lower := strings.ToLower(text + " " + event.Description)
	for _, marker := range []string{"interview", "screen", "recruiter", "technical", "onsite"} {
		if strings.Contains(lower, marker) {
			return "", text
		}
	}
	return "", ""
}

func (s *Server) handleGoogleCalendarDisconnect(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := calendarUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if _, err := s.DB.Conn.ExecContext(r.Context(), `DELETE FROM google_calendar_tokens WHERE user_id=$1 AND tenant_id=$2`, user.ID, tenantID); err != nil {
		s.respondError(w, http.StatusServiceUnavailable, "Failed to disconnect Google Calendar")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "connected": false, "revoked": "local_token_deleted", "read_only": true})
}
