package api

import "net/http"

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if s.metrics == nil {
		http.Error(w, "metrics unavailable", http.StatusServiceUnavailable)
		return
	}
	token := ""
	if s.Config != nil {
		token = s.Config.MetricsToken
	}
	s.metrics.Handler(token).ServeHTTP(w, r)
}
