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
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	scheme := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")))
	if scheme == "" {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(host)), "localhost") || strings.HasPrefix(strings.TrimSpace(host), "127.0.0.1") {
			scheme = "http"
		} else {
			scheme = "https"
		}
	}
	apiURL := fmt.Sprintf("%s://%s/api", scheme, strings.TrimSpace(host))
	publicSupabaseURL := strings.TrimRight(strings.TrimSpace(s.Config.SupabasePublicURL), "/")
	if publicSupabaseURL == "" {
		publicSupabaseURL = strings.TrimRight(strings.TrimSpace(s.Config.SupabaseURL), "/")
	}
	s.respondJSON(w, http.StatusOK, map[string]string{
		"supabase_url":             publicSupabaseURL,
		"supabase_publishable_key": s.Config.SupabaseKey,
		"api_url":                  apiURL,
	})
}
