package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// -------------------------------------------------------------------
// Browser Automation Agent proxy routes — user-based browser actions.
//
// Forwards requests to the Python AI service endpoint
// `/api/v1/browser/automation`.
// -------------------------------------------------------------------

// RegisterBrowserRoutes wires the browser automation proxy routes.
func (s *Server) RegisterBrowserRoutes(r chi.Router) {
	r.Post("/api/v1/browser/automation", s.handleBrowserAutomation)
	r.Post("/api/browser/automation", s.handleBrowserAutomation)
}

func (s *Server) handleBrowserAutomation(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}

	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/browser/automation", payload, headers)
	if err != nil {
		log.Printf("[BrowserAutomation] Proxy error: %v", err)
		http.Error(w, "failed to execute browser automation", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}
