package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// -------------------------------------------------------------------
// One-Stop Jobseeker Proxy Routes (Typst PDF, Radar, Voice Coach, Negotiation)
// -------------------------------------------------------------------

func (s *Server) RegisterOneStopRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		r.Post("/api/v1/export/typst-pdf", s.handleTypstExport)
		r.Post("/api/export/typst-pdf", s.handleTypstExport)

		r.Post("/api/v1/radar/check", s.handleOneStopProxy("/api/v1/radar/check"))
		r.Post("/api/radar/check", s.handleOneStopProxy("/api/v1/radar/check"))

		r.Post("/api/v1/interview/voice-feedback", s.handleOneStopProxy("/api/v1/interview/voice-feedback"))
		r.Post("/api/interview/voice-feedback", s.handleOneStopProxy("/api/v1/interview/voice-feedback"))

		r.Post("/api/v1/negotiation/generate", s.handleOneStopProxy("/api/v1/negotiation/generate"))
		r.Post("/api/negotiation/generate", s.handleOneStopProxy("/api/v1/negotiation/generate"))

		r.Post("/api/v1/skill-gap/analyze", s.handleOneStopProxy("/api/v1/skill-gap/analyze"))
		r.Post("/api/skill-gap/analyze", s.handleOneStopProxy("/api/v1/skill-gap/analyze"))

		r.Post("/api/v1/portfolio/generate", s.handleOneStopProxy("/api/v1/portfolio/generate"))
		r.Post("/api/portfolio/generate", s.handleOneStopProxy("/api/v1/portfolio/generate"))

		r.Post("/api/v1/outreach/generate", s.handleOneStopProxy("/api/v1/outreach/generate"))
		r.Post("/api/outreach/generate", s.handleOneStopProxy("/api/v1/outreach/generate"))

		r.Post("/api/v1/analytics/funnel", s.handleOneStopProxy("/api/v1/analytics/funnel"))
		r.Post("/api/analytics/funnel", s.handleOneStopProxy("/api/v1/analytics/funnel"))

		r.Post("/api/v1/privacy/check", s.handleOneStopProxy("/api/v1/privacy/check"))
		r.Post("/api/privacy/check", s.handleOneStopProxy("/api/v1/privacy/check"))
	})
}

func (s *Server) handleTypstExport(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	headers := s.getXUserHeaders(r)
	headers["Content-Type"] = "application/json"

	// Use PostJSON or direct client call for bytes response
	resp, err := s.AI.PostJSONWithHeaders("/api/v1/export/typst-pdf", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("[TypstExport] Proxy error: %v", err)
		http.Error(w, "failed to export typst pdf", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleOneStopProxy(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		headers := s.getXUserHeaders(r)
		result, err := s.AI.PostJSONWithHeaders(endpoint, payload, headers)
		if err != nil {
			log.Printf("[OneStopProxy] Failed endpoint %s: %v", endpoint, err)
			http.Error(w, "upstream AI service error", http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}
