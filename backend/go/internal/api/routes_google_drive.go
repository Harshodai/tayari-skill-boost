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

const googleDriveCapability = capabilities.Name("workspace.google.drive")

func (s *Server) routesGoogleDrive(r chi.Router) {
	r.Get("/api/oauth/google/drive/callback", s.handleGoogleDriveCallback)
	r.Get("/api/v1/oauth/google/drive/callback", s.handleGoogleDriveCallback)

	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/google/drive/status", s.handleGoogleDriveStatus)
		r.Get("/api/v1/google/drive/status", s.handleGoogleDriveStatus)
		r.Get("/api/google/drive/login", s.handleGoogleDriveLogin)
		r.Get("/api/v1/google/drive/login", s.handleGoogleDriveLogin)
		r.Post("/api/google/drive/sync", s.handleGoogleDriveSync)
		r.Post("/api/v1/google/drive/sync", s.handleGoogleDriveSync)
		r.Post("/api/google/drive/disconnect", s.handleGoogleDriveDisconnect)
		r.Post("/api/v1/google/drive/disconnect", s.handleGoogleDriveDisconnect)
	})
}

func driveUser(r *http.Request) (*models.User, uuid.UUID, bool) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		return nil, uuid.Nil, false
	}
	tenantID, ok := verifiedWorkspaceTenant(r, user)
	return user, tenantID, ok
}

func (s *Server) handleGoogleDriveStatus(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := driveUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !googleWorkspaceEnabled() {
		s.respondJSON(w, http.StatusOK, googleWorkspaceStatusResponse(false, false, string(googleDriveCapability), "Google Workspace is not configured on this server."))
		return
	}
	var count int
	err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM google_drive_tokens WHERE user_id=$1 AND tenant_id=$2`, user.ID, tenantID).Scan(&count)
	if err != nil {
		log.Printf("handleGoogleDriveStatus: token lookup failed: %v", err)
		s.respondError(w, http.StatusServiceUnavailable, "Drive connection status is unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, googleWorkspaceStatusResponse(true, count > 0, string(googleDriveCapability), ""))
}

func (s *Server) handleGoogleDriveLogin(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := driveUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.requireCapability(w, googleDriveCapability) {
		return
	}
	if !googleWorkspaceEnabled() {
		s.respondError(w, http.StatusNotImplemented, "Google Workspace is not configured on this server")
		return
	}
	state := "google-drive:" + uuid.NewString()
	if _, err := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO oauth_states (id, user_id, tenant_id, provider, state, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`, uuid.New(), user.ID, tenantID, "google_drive", state); err != nil {
		log.Printf("handleGoogleDriveLogin: failed to store OAuth state: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to initiate Drive OAuth")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"auth_url":  googleWorkspaceOAuthURL("drive", state, googleDriveScope),
		"scope":     googleDriveScope,
		"read_only": true,
	})
}

func (s *Server) handleGoogleDriveCallback(w http.ResponseWriter, r *http.Request) {
	frontendURL := googleWorkspaceFrontendURL()
	redirect := func(status string) {
		http.Redirect(w, r, frontendURL+"/settings?google_drive="+url.QueryEscape(status), http.StatusFound)
	}
	if r.URL.Query().Get("error") != "" || r.URL.Query().Get("code") == "" {
		redirect("denied")
		return
	}
	var userID, tenantID uuid.UUID
	var provider string
	err := s.DB.Conn.QueryRowContext(r.Context(), `DELETE FROM oauth_states WHERE state=$1 AND provider=$2 AND created_at > NOW()-INTERVAL '10 minutes' RETURNING user_id, tenant_id, provider`, r.URL.Query().Get("state"), "google_drive").Scan(&userID, &tenantID, &provider)
	if err != nil || provider != "google_drive" || userID == uuid.Nil || tenantID == uuid.Nil {
		log.Printf("handleGoogleDriveCallback: invalid or expired state: %v", err)
		redirect("error")
		return
	}
	token, err := googleWorkspaceExchangeCode(r.Context(), "drive", r.URL.Query().Get("code"))
	if err != nil {
		log.Printf("handleGoogleDriveCallback: token exchange failed: %v", err)
		redirect("error")
		return
	}
	_, err = s.DB.Conn.ExecContext(r.Context(), `INSERT INTO google_drive_tokens (id, user_id, tenant_id, access_token, refresh_token, expiry, scope, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) ON CONFLICT (user_id, tenant_id) DO UPDATE SET access_token=$4, refresh_token=CASE WHEN $5!='' THEN $5 ELSE google_drive_tokens.refresh_token END, expiry=$6, scope=$7, updated_at=NOW()`, uuid.New(), userID, tenantID, token.AccessToken, token.RefreshToken, googleWorkspaceExpiry(token.ExpiresIn), token.Scope)
	if err != nil {
		log.Printf("handleGoogleDriveCallback: token persistence failed: %v", err)
		redirect("error")
		return
	}
	redirect("connected")
}

func (s *Server) handleGoogleDriveSync(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := driveUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.requireCapability(w, googleDriveCapability) {
		return
	}
	if !googleWorkspaceEnabled() {
		s.respondError(w, http.StatusServiceUnavailable, "Google Drive is not configured")
		return
	}
	var accessToken, refreshToken string
	var expiry time.Time
	err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT access_token, refresh_token, expiry FROM google_drive_tokens WHERE user_id=$1 AND tenant_id=$2`, user.ID, tenantID).Scan(&accessToken, &refreshToken, &expiry)
	if err != nil {
		s.respondError(w, http.StatusPreconditionFailed, "Google Drive is not connected. Use Drive login first.")
		return
	}
	if time.Now().After(expiry.Add(-5 * time.Minute)) {
		refreshed, refreshErr := googleWorkspaceRefreshToken(r.Context(), refreshToken)
		if refreshErr != nil {
			s.respondError(w, http.StatusUnauthorized, "Google Drive token expired. Please reconnect.")
			return
		}
		accessToken = refreshed.AccessToken
		_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE google_drive_tokens SET access_token=$1, expiry=$2, updated_at=NOW() WHERE user_id=$3 AND tenant_id=$4`, accessToken, googleWorkspaceExpiry(refreshed.ExpiresIn), user.ID, tenantID)
	}
	files, err := googleDriveListCandidateFiles(r.Context(), accessToken)
	if err != nil {
		log.Printf("handleGoogleDriveSync: Drive API call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch Google Drive files")
		return
	}
	// Metadata-only first release: do not download or modify files. Persist a
	// tenant-bound provenance record while content remains in Google Drive.
	imported := 0
	for _, file := range files {
		if file.ID == "" {
			continue
		}
		_, writeErr := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO google_drive_files (id, user_id, tenant_id, provider_file_id, name, mime_type, modified_time, web_view_link, provenance, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'google_drive_readonly',NOW(),NOW()) ON CONFLICT (user_id, tenant_id, provider_file_id) DO UPDATE SET name=$5, mime_type=$6, modified_time=$7, web_view_link=$8, updated_at=NOW()`, uuid.New(), user.ID, tenantID, file.ID, file.Name, file.MimeType, parseGoogleDriveTime(file.ModifiedTime), file.WebViewLink)
		if writeErr == nil {
			imported++
		}
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "read_only": true, "metadata_only": true, "total": len(files), "imported": imported, "provenance": "google_drive_readonly"})
}

type googleDriveFile struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	MimeType     string `json:"mimeType"`
	ModifiedTime string `json:"modifiedTime"`
	WebViewLink  string `json:"webViewLink"`
}

func parseGoogleDriveTime(value string) *time.Time {
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return &parsed
	}
	return nil
}

func googleDriveListCandidateFiles(ctx context.Context, accessToken string) ([]googleDriveFile, error) {
	params := url.Values{
		"pageSize": {"50"},
		"orderBy":  {"modifiedTime desc"},
		"fields":   {"files(id,name,mimeType,modifiedTime,webViewLink)"},
		"q":        {"trashed = false and (name contains 'resume' or name contains 'cv' or name contains 'cover' or mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.document')"},
	}
	resp, err := googleWorkspaceAuthRequest(ctx, http.MethodGet, "https://www.googleapis.com/drive/v3/files?"+params.Encode(), accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("drive files status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload struct {
		Files []googleDriveFile `json:"files"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return payload.Files, nil
}

func (s *Server) handleGoogleDriveDisconnect(w http.ResponseWriter, r *http.Request) {
	user, tenantID, ok := driveUser(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if _, err := s.DB.Conn.ExecContext(r.Context(), `DELETE FROM google_drive_tokens WHERE user_id=$1 AND tenant_id=$2`, user.ID, tenantID); err != nil {
		s.respondError(w, http.StatusServiceUnavailable, "Failed to disconnect Google Drive")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "connected": false, "revoked": "local_token_deleted", "read_only": true})
}
