package api

import (
	"fmt"
	"net/http"
	"strings"
)

// handleExtensionAuthConfig returns only public client configuration. It never
// exposes the Supabase service-role key or any server-side signing secret.
func (s *Server) handleExtensionAuthConfig(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(s.Config.SupabaseURL) == "" || strings.TrimSpace(s.Config.SupabaseKey) == "" {
		s.respondError(w, http.StatusServiceUnavailable, "Extension OAuth is not configured.")
		return
	}
	scheme := r.Header.Get("X-Forwarded-Proto")
	if scheme == "" {
		scheme = "https"
	}
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	apiURL := fmt.Sprintf("%s://%s/api", strings.TrimSpace(scheme), strings.TrimSpace(host))
	s.respondJSON(w, http.StatusOK, map[string]string{
		"supabase_url":             strings.TrimRight(s.Config.SupabaseURL, "/"),
		"supabase_publishable_key": s.Config.SupabaseKey,
		"api_url":                  apiURL,
	})
}
