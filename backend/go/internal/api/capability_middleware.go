package api

import (
	"net/http"

	"tayari-backend/internal/capabilities"
)

func (s *Server) withCapability(name capabilities.Name, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.requireCapability(w, name) {
			return
		}
		next(w, r)
	}
}
