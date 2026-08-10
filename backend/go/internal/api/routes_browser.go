package api

import (
	"encoding/json"
	"io"
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
	r.Post("/api/v1/browser/automation/stream", s.handleBrowserAutomationStream)
	r.Post("/api/browser/automation/stream", s.handleBrowserAutomationStream)
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

// handleBrowserAutomationStream passes the Glass-Box screenshot SSE stream
// through verbatim (Moat-2 passthrough pattern, optional flusher).
func (s *Server) handleBrowserAutomationStream(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body = make(map[string]interface{})
	}

	upstream, err := s.AI.PostStream("/api/v1/browser/automation/stream", body, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleBrowserAutomationStream: upstream failed: %v", err)
		if status, ok := extractAIStatus(err); ok {
			s.respondError(w, status, "Upstream AI service error")
			return
		}
		s.respondError(w, http.StatusBadGateway, "Browser automation stream failed")
		return
	}
	defer upstream.Body.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 4096)
	for {
		n, err := upstream.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			if err != io.EOF {
				log.Printf("handleBrowserAutomationStream: read error: %v", err)
			}
			return
		}
	}
}
