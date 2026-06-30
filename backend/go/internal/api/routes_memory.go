package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// -------------------------------------------------------------------
// Memory layer proxy — conversations, preferences, feedback signals.
//
// Forwards to the Python AI engine under both archive-compatible
// (/api/...) and versioned (/api/v1/...) prefixes (route parity).
// User identity is passed via the X-User-Id header (s.getXUserHeaders),
// which the Python routes require — the Go auth middleware already
// validated the JWT, so we trust the context user id here.
//
// SRP: this file only proxies; business logic lives in the Python
// conversation_routes / preference_routes modules. OCP: add a memory
// endpoint by appending a handler + route pair, no branching change.
// -------------------------------------------------------------------

// RegisterMemoryRoutes wires the memory-layer proxy under both prefixes.
func (s *Server) RegisterMemoryRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		// Conversations
		r.Post("/api/v1/conversations", s.handleMemoryProxyPOST("/api/v1/conversations"))
		r.Post("/api/conversations", s.handleMemoryProxyPOST("/api/v1/conversations"))
		r.Get("/api/v1/conversations", s.handleMemoryProxyGET("/api/v1/conversations"))
		r.Get("/api/conversations", s.handleMemoryProxyGET("/api/v1/conversations"))
		r.Get("/api/v1/conversations/{convId}", s.handleMemoryProxyGETPath("/api/v1/conversations/"))
		r.Get("/api/conversations/{convId}", s.handleMemoryProxyGETPath("/api/v1/conversations/"))
		r.Post("/api/v1/conversations/{convId}/messages", s.handleMemoryProxyPOSTPath("/api/v1/conversations/", "/messages"))
		r.Post("/api/conversations/{convId}/messages", s.handleMemoryProxyPOSTPath("/api/v1/conversations/", "/messages"))
		r.Patch("/api/v1/conversations/{convId}", s.handleMemoryProxyPATCHPath("/api/v1/conversations/"))
		r.Patch("/api/conversations/{convId}", s.handleMemoryProxyPATCHPath("/api/v1/conversations/"))
		r.Delete("/api/v1/conversations/{convId}", s.handleMemoryProxyDELETEPath("/api/v1/conversations/"))
		r.Delete("/api/conversations/{convId}", s.handleMemoryProxyDELETEPath("/api/v1/conversations/"))

		// Preferences + feedback
		r.Get("/api/v1/preferences", s.handleMemoryProxyGET("/api/v1/preferences"))
		r.Get("/api/preferences", s.handleMemoryProxyGET("/api/v1/preferences"))
		r.Post("/api/v1/preferences/refresh", s.handleMemoryProxyPOST("/api/v1/preferences/refresh"))
		r.Post("/api/preferences/refresh", s.handleMemoryProxyPOST("/api/v1/preferences/refresh"))
		r.Post("/api/v1/preferences/feedback", s.handleMemoryProxyPOST("/api/v1/preferences/feedback"))
		r.Post("/api/preferences/feedback", s.handleMemoryProxyPOST("/api/v1/preferences/feedback"))
		r.Get("/api/v1/preferences/feedback", s.handleMemoryProxyGET("/api/v1/preferences/feedback"))
		r.Get("/api/preferences/feedback", s.handleMemoryProxyGET("/api/v1/preferences/feedback"))
	})
}

// handleMemoryProxyGET forwards a parameterless GET to the Python engine.
func (s *Server) handleMemoryProxyGET(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers := s.getXUserHeaders(r)
		result, err := s.AI.GetJSONWithHeaders(endpoint, headers)
		if err != nil {
			log.Printf("memory GET %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Memory service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyPOST forwards a parameterless POST (body verbatim) to Python.
func (s *Server) handleMemoryProxyPOST(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read request body")
			return
		}
		headers := s.getXUserHeaders(r)
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("memory POST %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Memory service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyGETPath forwards GET /api/v1/conversations/{convId} → Python.
func (s *Server) handleMemoryProxyGETPath(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		convID := chi.URLParam(r, "convId")
		endpoint := prefix + convID
		headers := s.getXUserHeaders(r)
		result, err := s.AI.GetJSONWithHeaders(endpoint, headers)
		if err != nil {
			log.Printf("memory GET %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Memory service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyPOSTPath forwards POST /conversations/{convId}/messages → Python.
func (s *Server) handleMemoryProxyPOSTPath(prefix, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		convID := chi.URLParam(r, "convId")
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read request body")
			return
		}
		endpoint := prefix + convID + suffix
		headers := s.getXUserHeaders(r)
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("memory POST %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Memory service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyPATCHPath forwards PATCH /conversations/{convId} → Python.
func (s *Server) handleMemoryProxyPATCHPath(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		convID := chi.URLParam(r, "convId")
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read request body")
			return
		}
		endpoint := prefix + convID
		headers := s.getXUserHeaders(r)
		result, err := s.AI.PatchJSONWithHeaders(endpoint, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("memory PATCH %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Memory service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyDELETEPath forwards DELETE /conversations/{convId} → Python.
func (s *Server) handleMemoryProxyDELETEPath(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		convID := chi.URLParam(r, "convId")
		endpoint := prefix + convID
		headers := s.getXUserHeaders(r)
		result, err := s.AI.DeleteJSONWithHeaders(endpoint, headers)
		if err != nil {
			log.Printf("memory DELETE %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Memory service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}