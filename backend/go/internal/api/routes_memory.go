package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"tayari-backend/internal/ai"
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
		r.Get("/api/v1/conversations/{convId}", s.handleMemoryProxyGETPath("/api/v1/conversations/", "convId"))
		r.Get("/api/conversations/{convId}", s.handleMemoryProxyGETPath("/api/v1/conversations/", "convId"))
		r.Post("/api/v1/conversations/{convId}/messages", s.handleMemoryProxyPOSTPath("/api/v1/conversations/", "/messages", "convId"))
		r.Post("/api/conversations/{convId}/messages", s.handleMemoryProxyPOSTPath("/api/v1/conversations/", "/messages", "convId"))
		r.Patch("/api/v1/conversations/{convId}", s.handleMemoryProxyPATCHPath("/api/v1/conversations/", "convId"))
		r.Patch("/api/conversations/{convId}", s.handleMemoryProxyPATCHPath("/api/v1/conversations/", "convId"))
		r.Delete("/api/v1/conversations/{convId}", s.handleMemoryProxyDELETEPath("/api/v1/conversations/", "convId"))
		r.Delete("/api/conversations/{convId}", s.handleMemoryProxyDELETEPath("/api/v1/conversations/", "convId"))

		// Preferences + feedback
		r.Get("/api/v1/preferences", s.handleMemoryProxyGET("/api/v1/preferences"))
		r.Get("/api/preferences", s.handleMemoryProxyGET("/api/v1/preferences"))
		r.Post("/api/v1/preferences/refresh", s.handleMemoryProxyPOST("/api/v1/preferences/refresh"))
		r.Post("/api/preferences/refresh", s.handleMemoryProxyPOST("/api/v1/preferences/refresh"))
		r.Post("/api/v1/preferences/feedback", s.handleMemoryProxyPOST("/api/v1/preferences/feedback"))
		r.Post("/api/preferences/feedback", s.handleMemoryProxyPOST("/api/v1/preferences/feedback"))
		r.Get("/api/v1/preferences/feedback", s.handleMemoryProxyGET("/api/v1/preferences/feedback"))
		r.Get("/api/preferences/feedback", s.handleMemoryProxyGET("/api/v1/preferences/feedback"))
		r.Get("/api/v1/preferences/controls", s.handleMemoryProxyGET("/api/v1/preferences/controls"))
		r.Get("/api/preferences/controls", s.handleMemoryProxyGET("/api/v1/preferences/controls"))
		r.Patch("/api/v1/preferences/controls/{controlId}", s.handleMemoryProxyPATCHPath("/api/v1/preferences/controls/", "controlId"))
		r.Patch("/api/preferences/controls/{controlId}", s.handleMemoryProxyPATCHPath("/api/v1/preferences/controls/", "controlId"))
		r.Delete("/api/v1/preferences/controls/{controlId}", s.handleMemoryProxyDELETEPath("/api/v1/preferences/controls/", "controlId"))
		r.Delete("/api/preferences/controls/{controlId}", s.handleMemoryProxyDELETEPath("/api/v1/preferences/controls/", "controlId"))

		// Preparation outcomes (consent-gated progress metadata)
		r.Post("/api/v1/preparation/outcomes", s.handleMemoryProxyPOST("/api/v1/preparation/outcomes"))
		r.Post("/api/preparation/outcomes", s.handleMemoryProxyPOST("/api/v1/preparation/outcomes"))
		r.Get("/api/v1/preparation/outcomes", s.handleMemoryProxyGET("/api/v1/preparation/outcomes"))
		r.Get("/api/preparation/outcomes", s.handleMemoryProxyGET("/api/v1/preparation/outcomes"))

	})
}

// respondMemoryError forwards the Python engine's real 4xx (a client mistake
// — bad payload, missing field, not found) as that same status with its real
// detail, instead of a blanket 502 that falsely tells the caller the memory
// service is down. Genuine upstream/network failures (no *ai.APIError, or a
// 5xx from Python) still respond 502.
func (s *Server) respondMemoryError(w http.ResponseWriter, action, endpoint string, err error) {
	log.Printf("memory %s %s: AI call failed: %v", action, endpoint, err)
	var apiErr *ai.APIError
	if errors.As(err, &apiErr) && apiErr.StatusCode >= 400 && apiErr.StatusCode < 500 {
		s.respondError(w, apiErr.StatusCode, apiErr.Body)
		return
	}
	s.respondError(w, http.StatusBadGateway, "Memory service unavailable")
}

// handleMemoryProxyGET forwards a parameterless GET to the Python engine.
func (s *Server) handleMemoryProxyGET(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers := s.getXUserHeaders(r)
		result, err := s.AI.GetJSONWithHeaders(endpoint, headers)
		if err != nil {
			s.respondMemoryError(w, "GET", endpoint, err)
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
			s.respondMemoryError(w, "POST", endpoint, err)
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyGETPath forwards GET <prefix>{paramName} → Python. paramName
// must match the chi URL-param name declared in the route pattern that wires
// this handler — different routes reuse this factory with different param
// names (e.g. "convId" for conversations, "controlId" for memory controls).
func (s *Server) handleMemoryProxyGETPath(prefix, paramName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, paramName)
		endpoint := prefix + id
		headers := s.getXUserHeaders(r)
		result, err := s.AI.GetJSONWithHeaders(endpoint, headers)
		if err != nil {
			s.respondMemoryError(w, "GET", endpoint, err)
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyPOSTPath forwards POST <prefix>{paramName}<suffix> → Python.
func (s *Server) handleMemoryProxyPOSTPath(prefix, suffix, paramName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, paramName)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read request body")
			return
		}
		endpoint := prefix + id + suffix
		headers := s.getXUserHeaders(r)
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), headers)
		if err != nil {
			s.respondMemoryError(w, "POST", endpoint, err)
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyPATCHPath forwards PATCH <prefix>{paramName} → Python.
func (s *Server) handleMemoryProxyPATCHPath(prefix, paramName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, paramName)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read request body")
			return
		}
		endpoint := prefix + id
		headers := s.getXUserHeaders(r)
		result, err := s.AI.PatchJSONWithHeaders(endpoint, json.RawMessage(body), headers)
		if err != nil {
			s.respondMemoryError(w, "PATCH", endpoint, err)
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// handleMemoryProxyDELETEPath forwards DELETE <prefix>{paramName} → Python.
func (s *Server) handleMemoryProxyDELETEPath(prefix, paramName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, paramName)
		endpoint := prefix + id
		headers := s.getXUserHeaders(r)
		result, err := s.AI.DeleteJSONWithHeaders(endpoint, headers)
		if err != nil {
			s.respondMemoryError(w, "DELETE", endpoint, err)
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}
