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

		// Omnisave is URL-import-first. These routes proxy only to the Python
		// lifecycle service; no legacy saved_posts table participates in this
		// candidate knowledge path.
		r.Get("/api/v1/saves", s.handleOneStopProxyGET("/api/v1/saves"))
		r.Get("/api/saves", s.handleOneStopProxyGET("/api/v1/saves"))
		r.Post("/api/v1/saves/import", s.handleOneStopProxy("/api/v1/saves/import"))
		r.Post("/api/saves/import", s.handleOneStopProxy("/api/v1/saves/import"))
		r.Post("/api/v1/saves/sync", s.handleOneStopProxy("/api/v1/saves/sync"))
		r.Post("/api/saves/sync", s.handleOneStopProxy("/api/v1/saves/sync"))
		r.Delete("/api/v1/saves/{source_id}", s.handleOneStopProxyDELETEPath("/api/v1/saves/", "source_id"))
		r.Delete("/api/saves/{source_id}", s.handleOneStopProxyDELETEPath("/api/v1/saves/", "source_id"))

		r.Post("/api/v1/one-shot/execute", s.handleOneStopProxy("/api/v1/one-shot/execute"))
		r.Post("/api/one-shot/execute", s.handleOneStopProxy("/api/v1/one-shot/execute"))
		r.Post("/api/v1/agent/runs/{run_id}/transition", s.handleRunActionPOST("/api/v1/agent/runs/", "transition"))
		r.Post("/api/agent/runs/{run_id}/transition", s.handleRunActionPOST("/api/v1/agent/runs/", "transition"))
		r.Post("/api/v1/agent/runs/{run_id}/handoff", s.handleRunActionPOST("/api/v1/agent/runs/", "handoff"))
		r.Post("/api/v1/agent/runs/{run_id}/resume", s.handleRunActionPOST("/api/v1/agent/runs/", "resume"))
		r.Post("/api/v1/agent/runs/{run_id}/cancel", s.handleRunActionPOST("/api/v1/agent/runs/", "cancel"))
		r.Get("/api/v1/agent/runs/{run_id}/handoff", s.handleRunActionGET("/api/v1/agent/runs/", "handoff"))
		r.Post("/api/agent/runs/{run_id}/handoff", s.handleRunActionPOST("/api/v1/agent/runs/", "handoff"))
		r.Post("/api/agent/runs/{run_id}/resume", s.handleRunActionPOST("/api/v1/agent/runs/", "resume"))
		r.Post("/api/agent/runs/{run_id}/cancel", s.handleRunActionPOST("/api/v1/agent/runs/", "cancel"))
		r.Get("/api/agent/runs/{run_id}/handoff", s.handleRunActionGET("/api/v1/agent/runs/", "handoff"))

		r.Get("/api/v1/agent/questions", s.handleOneStopProxyGET("/api/v1/agent/questions"))
		r.Get("/api/agent/questions", s.handleOneStopProxyGET("/api/v1/agent/questions"))
		r.Get("/api/v1/candidate/answers", s.handleOneStopProxyGET("/api/v1/candidate/answers"))
		r.Get("/api/candidate/answers", s.handleOneStopProxyGET("/api/v1/candidate/answers"))
		r.Put("/api/v1/candidate/answers", s.handleOneStopProxyPUT("/api/v1/candidate/answers"))
		r.Put("/api/candidate/answers", s.handleOneStopProxyPUT("/api/v1/candidate/answers"))
		r.Patch("/api/v1/agent/questions/{question_id}", s.handleQuestionProxyPATCH("/api/v1/agent/questions/"))
		r.Patch("/api/agent/questions/{question_id}", s.handleQuestionProxyPATCH("/api/v1/agent/questions/"))

		r.Get("/api/v1/agent-reach/doctor", s.handleOneStopProxyGET("/api/v1/agent-reach/doctor"))
		r.Get("/api/agent-reach/doctor", s.handleOneStopProxyGET("/api/v1/agent-reach/doctor"))
		r.Post("/api/v1/agent-reach/search", s.handleOneStopProxy("/api/v1/agent-reach/search"))
		r.Post("/api/agent-reach/search", s.handleOneStopProxy("/api/v1/agent-reach/search"))
		r.Post("/api/v1/agent-reach/transcribe", s.handleOneStopProxy("/api/v1/agent-reach/transcribe"))
		r.Post("/api/agent-reach/transcribe", s.handleOneStopProxy("/api/v1/agent-reach/transcribe"))

		r.Post("/api/v1/candidate-bank/match", s.handleOneStopProxy("/api/v1/candidate-bank/match"))
		r.Post("/api/candidate-bank/match", s.handleOneStopProxy("/api/v1/candidate-bank/match"))

		// ats/detect, guardrails/truth-check, recruiter/lookup, offer/calculate,
		// interview/copilot, agent-reach/extract, agent-reach/cookies,
		// candidate-answer-bank/match, and communication/suggestions are NOT
		// registered here — routesMVP (routes_mvp.go) registers the same
		// method+pattern for all nine with billing-gated handlers
		// (handleATSDetect, handleTruthCheck, handleRecruiterLookup,
		// handleOfferCalculate, handleInterviewCopilot, handleAgentReachExtract,
		// handleAgentReachCookies, handleCandidateBankMatch,
		// handleCommunicationSuggestions) and is called after
		// RegisterOneStopRoutes in router.go's s.routes(), so chi's "last
		// registration wins" behavior means routesMVP's versions are the only
		// ones actually reachable. Registering them here too was dead code that
		// silently lost the billing entitlement checks if the registration
		// order ever changed (and, for candidate-answer-bank/match specifically,
		// proxied to a nonexistent Python endpoint — the real one is
		// /api/v1/candidate-bank/match, which routesMVP's handler calls
		// correctly) — see routesMVP's comment for the counterpart.
	})
}

func (s *Server) handleOneStopProxyDELETEPath(prefix, parameter string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		value := chi.URLParam(r, parameter)
		if value == "" {
			http.Error(w, "missing resource identifier", http.StatusBadRequest)
			return
		}
		headers := s.getXUserHeaders(r)
		result, err := s.AI.DeleteJSONWithHeaders(prefix+value, headers)
		if err != nil {
			log.Printf("[OneStopProxy] DELETE %s failed: %v", prefix+value, err)
			http.Error(w, "knowledge source deletion failed", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
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

func (s *Server) handleOneStopProxyGET(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers := s.getXUserHeaders(r)
		if r.URL.RawQuery != "" {
			endpoint += "?" + r.URL.RawQuery
		}
		result, err := s.AI.GetJSONWithHeaders(endpoint, headers)
		if err != nil {
			log.Printf("[OneStopProxyGET] AI service error for %s: %v", endpoint, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":    "ai_service_unavailable",
				"endpoint": endpoint,
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}

func (s *Server) handleOneStopProxyPUT(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		result, err := s.AI.PutJSONWithHeaders(endpoint, payload, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OneStopProxyPUT] AI service error for %s: %v", endpoint, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]interface{}{"error": "ai_service_unavailable"})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}

func (s *Server) handleRunActionGET(prefix string, action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		runID := chi.URLParam(r, "run_id")
		if runID == "" {
			http.Error(w, "missing run identifier", http.StatusBadRequest)
			return
		}
		result, err := s.AI.GetJSONWithHeaders(prefix+runID+"/"+action, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[RunActionGET] AI service error: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]interface{}{"error": "ai_service_unavailable"})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}

func (s *Server) handleRunActionPOST(prefix string, action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		runID := chi.URLParam(r, "run_id")
		if runID == "" {
			http.Error(w, "missing run identifier", http.StatusBadRequest)
			return
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		result, err := s.AI.PostJSONWithHeaders(prefix+runID+"/"+action, payload, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[RunActionProxy] AI service error: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]interface{}{"error": "ai_service_unavailable"})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}

func (s *Server) handleQuestionProxyPATCH(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		questionID := chi.URLParam(r, "question_id")
		if questionID == "" {
			http.Error(w, "missing question identifier", http.StatusBadRequest)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()
		headers := s.getXUserHeaders(r)
		headers["Content-Type"] = "application/json"
		result, err := s.AI.PatchJSONWithHeaders(prefix+questionID, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("[QuestionProxy] AI service error: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]interface{}{"error": "ai_service_unavailable"})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}

func (s *Server) handleOneStopProxy(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			payload = map[string]interface{}{}
		}

		headers := s.getXUserHeaders(r)
		result, err := s.AI.PostJSONWithHeaders(endpoint, payload, headers)
		if err != nil {
			log.Printf("[OneStopProxy] AI service error for %s: %v", endpoint, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":    "ai_service_unavailable",
				"endpoint": endpoint,
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	}
}
