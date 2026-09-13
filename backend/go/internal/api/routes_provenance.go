package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
)

// RegisterProvenanceRoutes keeps AI provenance behind the Go gateway. The
// gateway forwards only the verified user identity; callers cannot choose the
// Python user_id independently.
func (s *Server) RegisterProvenanceRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/v1/provenance/artifacts", s.handleProvenanceGET("/api/v1/provenance/artifacts"))
		r.Get("/api/provenance/artifacts", s.handleProvenanceGET("/api/v1/provenance/artifacts"))
		r.Get("/api/v1/provenance/artifacts/{artifactId}", s.handleProvenanceGETPath("/api/v1/provenance/artifacts/"))
		r.Get("/api/provenance/artifacts/{artifactId}", s.handleProvenanceGETPath("/api/v1/provenance/artifacts/"))
		r.Post("/api/v1/provenance/artifacts/{artifactId}/disclosure", s.handleProvenancePOSTPath("/api/v1/provenance/artifacts/", "/disclosure"))
		r.Post("/api/provenance/artifacts/{artifactId}/disclosure", s.handleProvenancePOSTPath("/api/v1/provenance/artifacts/", "/disclosure"))
		r.Get("/api/v1/provenance/export", s.handleProvenanceGET("/api/v1/provenance/export"))
		r.Get("/api/provenance/export", s.handleProvenanceGET("/api/v1/provenance/export"))
	})
}

func (s *Server) handleProvenanceGET(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		target := endpoint
		if r.URL.RawQuery != "" {
			target += "?" + r.URL.RawQuery
		}
		result, err := s.AI.GetJSONWithHeaders(target, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("provenance GET %s: AI call failed: %v", target, err)
			s.respondError(w, http.StatusBadGateway, "Provenance service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleProvenanceGETPath(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		artifactID := url.PathEscape(chi.URLParam(r, "artifactId"))
		endpoint := prefix + artifactID
		if r.URL.RawQuery != "" {
			endpoint += "?" + r.URL.RawQuery
		}
		result, err := s.AI.GetJSONWithHeaders(endpoint, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("provenance GET %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Provenance service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleProvenancePOSTPath(prefix, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 32*1024))
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read provenance request")
			return
		}
		artifactID := url.PathEscape(chi.URLParam(r, "artifactId"))
		endpoint := prefix + artifactID + suffix
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
		if err != nil {
			log.Printf("provenance POST %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Provenance service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}
