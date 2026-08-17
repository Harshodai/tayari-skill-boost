package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// RegisterComputerRoutes keeps both isolated-computer and local-browser bridge
// control behind the verified Go gateway identity boundary.
func (s *Server) RegisterComputerRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Post("/api/v1/computer/runs", s.handleComputerPOST("/api/v1/computer/runs"))
		r.Post("/api/computer/runs", s.handleComputerPOST("/api/v1/computer/runs"))
		r.Get("/api/v1/computer/runs/{runId}", s.handleComputerGETPath("/api/v1/computer/runs/"))
		r.Get("/api/computer/runs/{runId}", s.handleComputerGETPath("/api/v1/computer/runs/"))
		r.Post("/api/v1/computer/runs/{runId}/bridge/attach", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/attach"))
		r.Post("/api/v1/computer/runs/{runId}/bridge/action/authorize", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/action/authorize"))
		r.Post("/api/v1/computer/runs/{runId}/bridge/observation", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/observation"))
		r.Post("/api/computer/runs/{runId}/bridge/attach", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/attach"))
		r.Post("/api/computer/runs/{runId}/bridge/action/authorize", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/action/authorize"))
		r.Post("/api/computer/runs/{runId}/bridge/observation", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/observation"))
		r.Post("/api/v1/computer/runs/{runId}/revoke", s.handleComputerPOSTPath("/api/v1/computer/runs/", "/revoke"))
		r.Post("/api/computer/runs/{runId}/revoke", s.handleComputerPOSTPath("/api/v1/computer/runs/", "/revoke"))
	})
}

func (s *Server) verifiedComputerHeaders(r *http.Request) (map[string]string, bool) {
	authorization, ok := auth.AuthorizationContextFromContext(r.Context())
	if !ok || authorization.Subject == uuid.Nil || authorization.TenantID == uuid.Nil {
		return nil, false
	}
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil || user.ID != authorization.Subject {
		return nil, false
	}
	headers := s.getXUserHeaders(r)
	headers["X-Tenant-Id"] = authorization.TenantID.String()
	return headers, true
}

func (s *Server) handleComputerPOST(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 32*1024))
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read computer request")
			return
		}
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("computer POST %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusCreated, result)
	}
}

func (s *Server) handleComputerGETPath(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		if _, err := uuid.Parse(runID); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid computer run id")
			return
		}
		result, err := s.AI.GetJSONWithHeaders(prefix+runID, headers)
		if err != nil {
			log.Printf("computer GET %s: AI call failed: %v", prefix+runID, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleComputerPOSTBodyPath(prefix, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		if _, err := uuid.Parse(runID); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid computer run id")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 32*1024))
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read computer bridge request")
			return
		}
		result, err := s.AI.PostJSONWithHeaders(prefix+runID+suffix, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("computer POST %s: AI call failed: %v", prefix+runID+suffix, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleComputerPOSTPath(prefix, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		if _, err := uuid.Parse(runID); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid computer run id")
			return
		}
		result, err := s.AI.PostJSONWithHeaders(prefix+runID+suffix, json.RawMessage(`{}`), headers)
		if err != nil {
			log.Printf("computer POST %s: AI call failed: %v", prefix+runID+suffix, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}
